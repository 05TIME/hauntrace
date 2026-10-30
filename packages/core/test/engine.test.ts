import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  canonicalJson, createRng, replay, run, verifyChain, whatIf, GENESIS_HASH,
  type AgentDefinition,
} from "../src/index.js";

type S = { total: number };
type O = { n: number };
type A = { kind: "big" | "small" | "coin"; value: number };

const agent: AgentDefinition<S, O, A> = {
  name: "counter",
  version: "1",
  initialState: { total: 0 },
  rules: [
    { id: "big", description: "n >= 10", evaluate: ({ obs }) => (obs.n >= 10 ? { action: { kind: "big", value: obs.n }, reason: `n=${obs.n} >= 10` } : null) },
    { id: "small", description: "n < 0", evaluate: ({ obs }) => (obs.n < 0 ? { action: { kind: "small", value: obs.n }, reason: "negative" } : null) },
  ],
  fallback: ({ rng }) => ({ action: { kind: "coin", value: rng.int(0, 100) }, reason: "coin flip" }),
  reduce: (s, _o, a) => ({ total: s.total + a.value }),
};
const opts = { seed: 7, startMs: 1000, stepMs: 10 };
const obsArb = fc.array(fc.record({ n: fc.integer({ min: -50, max: 50 }) }), { maxLength: 30 });

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = createRng(42), b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it("int stays in range (property)", () => {
    fc.assert(fc.property(fc.integer(), fc.integer({ min: -1000, max: 1000 }), fc.nat(1000), (seed, min, span) => {
      const v = createRng(seed).int(min, min + span);
      return v >= min && v <= min + span && Number.isInteger(v);
    }));
  });
  it("rejects bad ranges", () => expect(() => createRng(1).int(5, 1)).toThrow(RangeError));
});

describe("canonicalJson", () => {
  it("sorts keys and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: 2 } })).toBe('{"a":{"c":2},"b":1}');
  });
  it("rejects non-finite numbers", () => expect(() => canonicalJson({ x: NaN })).toThrow());
});

describe("run", () => {
  it("fires first matching rule and records reason, time and chain", () => {
    const t = run(agent, [{ n: 12 }, { n: -3 }, { n: 4 }], opts);
    expect(t.ghosts.map((g) => g.ruleId)).toEqual(["big", "small", "fallback"]);
    expect(t.ghosts[0]!.reason).toBe("n=12 >= 10");
    expect(t.ghosts.map((g) => g.timeMs)).toEqual([1000, 1010, 1020]);
    expect(t.ghosts[0]!.prevHash).toBe(GENESIS_HASH);
    expect(t.ghosts[1]!.prevHash).toBe(t.ghosts[0]!.hash);
    expect(t.headHash).toBe(t.ghosts[2]!.hash);
  });
  it("same seed + inputs => same head hash (property)", () => {
    fc.assert(fc.property(obsArb, fc.integer(), (obs, seed) =>
      run(agent, obs, { ...opts, seed }).headHash === run(agent, obs, { ...opts, seed }).headHash));
  });
  it("does not mutate inputs or initial state", () => {
    const obs = [{ n: 1 }];
    run(agent, obs, opts);
    expect(obs).toEqual([{ n: 1 }]);
    expect(agent.initialState).toEqual({ total: 0 });
  });
  it("rejects duplicate rule ids", () => {
    const bad = { ...agent, rules: [agent.rules[0]!, agent.rules[0]!] };
    expect(() => run(bad, [], opts)).toThrow(/duplicate/);
  });
});

describe("verify and replay", () => {
  it("replays any run exactly (property)", () => {
    fc.assert(fc.property(obsArb, (obs) => replay(agent, run(agent, obs, opts)).ok));
  });
  it("detects tampering", () => {
    const t = run(agent, [{ n: 1 }, { n: 2 }], opts);
    t.ghosts[0]!.reason = "edited";
    expect(verifyChain(t)).toMatchObject({ ok: false, brokenAt: 0 });
  });
  it("detects a changed ruleset", () => {
    const t = run(agent, [{ n: 1 }], opts);
    expect(replay({ ...agent, version: "2" }, t)).toMatchObject({ ok: false, reason: "ruleset changed" });
  });
});

describe("whatIf", () => {
  it("reports only changed decisions and leaves original intact", () => {
    const t = run(agent, [{ n: 12 }, { n: -3 }], opts);
    const head = t.headHash;
    const wi = whatIf(agent, t, (o, i) => (i === 1 ? { n: 20 } : o));
    expect(wi.diffs).toHaveLength(1);
    expect(wi.diffs[0]).toMatchObject({ step: 1, before: { ruleId: "small" }, after: { ruleId: "big" } });
    expect(t.headHash).toBe(head);
  });
  it("identity patch yields no diffs (property)", () => {
    fc.assert(fc.property(obsArb, (obs) => whatIf(agent, run(agent, obs, opts), (o) => o).diffs.length === 0));
  });
});
