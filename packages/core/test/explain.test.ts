import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { run, exportTrace } from "../src/index.js";
import type { AgentDefinition } from "../src/index.js";
import { explainRun, explainText } from "../src/explain.js";
import { explainJson } from "../src/explain-cli.js";
import { verifyChain } from "../src/engine.js";

interface Obs { n: number }
const agent: AgentDefinition<{ seen: number }, Obs, { label: string }> = {
  name: "demo",
  version: "1",
  initialState: { seen: 0 },
  rules: [
    {
      id: "big",
      description: "n >= 10",
      evaluate: ({ obs }) => (obs.n >= 10 ? { action: { label: "alert" }, reason: `n=${obs.n} is large` } : null),
    },
    {
      id: "negative",
      description: "n < 0",
      evaluate: ({ obs }) => (obs.n < 0 ? { action: { label: "warn" }, reason: `n=${obs.n} is negative` } : null),
    },
  ],
  fallback: ({ rng }) => ({ action: { label: `ignore-${rng.int(0, 9)}` }, reason: "nothing matched" }),
  reduce: (s) => ({ seen: s.seen + 1 }),
};
const opts = { seed: 5, startMs: Date.UTC(2026, 9, 31), stepMs: 60_000 };

describe("explainRun (core)", () => {
  it("names every step, rule and reason, and reports a verified chain", () => {
    const trace = run(agent, [{ n: 12 }, { n: -3 }, { n: 4 }], opts);
    const story = explainRun(trace, verifyChain(trace));
    expect(story.steps).toHaveLength(3);
    expect(story.steps[0]).toContain('rule "big" fired because n=12 is large');
    expect(story.steps[1]).toContain('rule "negative"');
    expect(story.steps[2]).toContain("fallback");
    expect(story.steps[2]).toContain("nothing matched");
    expect(story.steps[0]).toContain("2026-10-31 00:00:00 UTC");
    expect(story.closing).toContain("verifies");
    expect(story.closing).toContain(trace.headHash.slice(0, 12));
  });

  it("is deterministic (property)", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -20, max: 30 }), { maxLength: 15 }), fc.integer(), (ns, seed) => {
        const o = { ...opts, seed };
        const t1 = run(agent, ns.map((n) => ({ n })), o);
        const t2 = run(agent, ns.map((n) => ({ n })), o);
        const e1 = explainText(explainRun(t1, verifyChain(t1)));
        expect(explainText(explainRun(t2, verifyChain(t2)))).toBe(e1);
        for (const g of t1.ghosts) expect(e1).toContain(g.ruleId);
        expect(e1.split("\n")).toHaveLength(ns.length + 2);
      }),
    );
  });

  it("says the chain is broken for a tampered trace", () => {
    const trace = run(agent, [{ n: 1 }, { n: 20 }], opts);
    trace.ghosts[1]!.reason = "forged";
    const v = verifyChain(trace);
    expect(v.ok).toBe(false);
    const story = explainRun(trace, v);
    expect(story.closing).toContain("BROKEN at step 2");
    expect(story.closing).toContain("hash mismatch");
  });
});

describe("explainJson (CLI helper)", () => {
  it("explains an exported trace file and a bare trace", () => {
    const trace = run(agent, [{ n: 50 }], opts);
    const a = explainJson(exportTrace(trace));
    const b = explainJson(JSON.stringify(trace));
    expect(a.ok).toBe(true);
    expect(a.text).toBe(b.text);
    expect(a.text).toContain('rule "big"');
  });

  it("reports ok=false and BROKEN for a tampered file", () => {
    const trace = run(agent, [{ n: 50 }], opts);
    const tampered = JSON.parse(exportTrace(trace));
    tampered.trace.ghosts[0].reason = "forged";
    const r = explainJson(JSON.stringify(tampered));
    expect(r.ok).toBe(false);
    expect(r.text).toContain("BROKEN");
  });

  it("throws on invalid input", () => {
    expect(() => explainJson("not json")).toThrow(/invalid JSON/);
    expect(() => explainJson('{"schemaVersion":1}')).toThrow();
  });
});

describe("explainRun robustness", () => {
  const base = {
    agent: "a",
    agentVersion: "1",
    headHash: "f".repeat(64),
    options: { seed: 1 },
  };

  it("is independent of action key order and truncates huge actions", () => {
    const g = { step: 0, timeMs: 0, ruleId: "r", reason: "why" };
    const a = explainRun({ ...base, ghosts: [{ ...g, action: { a: 1, b: 2 } }] }, { ok: true });
    const b = explainRun({ ...base, ghosts: [{ ...g, action: { b: 2, a: 1 } }] }, { ok: true });
    expect(a).toEqual(b);
    const big = explainRun({ ...base, ghosts: [{ ...g, action: { s: "x".repeat(5000) } }] }, { ok: true });
    expect(big.steps[0]!.length).toBeLessThan(400);
    expect(big.steps[0]).toContain("…");
  });

  it("does not throw on out-of-range times or undefined actions", () => {
    const ghosts = [
      { step: 0, timeMs: 8.64e15 + 1, ruleId: "r", reason: "why", action: undefined },
      { step: 1, timeMs: Number.MAX_SAFE_INTEGER, ruleId: "fallback", reason: "none", action: null },
    ];
    const story = explainRun({ ...base, ghosts }, { ok: true });
    expect(story.steps).toHaveLength(2);
    expect(story.steps[0]).toContain("t=");
  });

  it("handles unicode reasons, singular wording and a broken chain without a step", () => {
    const g = { step: 0, timeMs: 0, ruleId: "r", reason: "日本語 🎃", action: "go" };
    const ok = explainRun({ ...base, ghosts: [g] }, { ok: true });
    expect(ok.intro).toContain("1 step ");
    expect(ok.steps[0]).toContain("日本語 🎃");
    expect(ok.closing).toContain("1 step is intact");
    const bad = explainRun({ ...base, ghosts: [g] }, { ok: false, reason: "headHash mismatch" });
    expect(bad.closing).toContain("BROKEN (headHash mismatch)");
  });
});
