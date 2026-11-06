/**
 * Tests for liveWhatIf.ts (Feature A: live what-if editor).
 *
 * fast-check is not a dependency of the viewer, so the "property" tests use a
 * seeded Rng from core to generate many observations deterministically.
 */
import { describe, it, expect } from "vitest";
import {
  observationToText,
  parseObservationText,
  runLiveWhatIf,
  isUnedited,
} from "../src/liveWhatIf.js";
import { createRng } from "../../packages/core/src/rng.js";
import { canonicalJson } from "../src/hash.js";
import npcTraceFile from "../src/example-trace-npc.json";
import shortletTraceFile from "../src/example-trace.json";
import type { Trace } from "../src/types.js";

const npc = npcTraceFile.trace as unknown as Trace;
const shortlet = shortletTraceFile.trace as unknown as Trace;
const traces: Trace[] = [npc, shortlet];

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  expect(r.ok).toBe(true);
  return r as Extract<T, { ok: true }>;
}

describe("unedited input ⟹ zero diffs", () => {
  for (const trace of traces) {
    it(`${trace.agent}: every step, pretty-printed original text`, () => {
      trace.ghosts.forEach((g, step) => {
        const r = ok(runLiveWhatIf(trace, step, observationToText(g.obs)));
        expect(r.diffs).toEqual([]);
        expect(r.changedSteps.size).toBe(0);
      });
    });

    it(`${trace.agent}: whitespace/key-order differences are not edits`, () => {
      trace.ghosts.forEach((g, step) => {
        const obj = g.obs as Record<string, unknown>;
        const reordered = JSON.stringify(
          Object.fromEntries(Object.entries(obj).reverse()),
        );
        expect(isUnedited(reordered, g.obs)).toBe(true);
        expect(ok(runLiveWhatIf(trace, step, reordered)).diffs).toHaveLength(0);
      });
    });
  }
});

describe("a real edit changes later decisions", () => {
  it("npc step 0: bringing the lantern flips low-trust → lantern-gift", () => {
    const obs = {
      ...(npc.ghosts[0]!.obs as Record<string, unknown>),
      hasLantern: true,
      playerAction: "offer-lantern",
    };
    const r = ok(runLiveWhatIf(npc, 0, JSON.stringify(obs)));
    expect(r.changedSteps.has(0)).toBe(true);
    const d = r.diffs.find((x) => x.step === 0)!;
    expect(d.before.ruleId).toBe("low-trust");
    expect(d.after.ruleId).toBe("lantern-gift");
  });

  it("steps before the edited step never differ", () => {
    const step = 3;
    const obs = {
      ...(npc.ghosts[step]!.obs as Record<string, unknown>),
      playerTrust: 100,
      hourOfNight: 12,
    };
    const r = ok(runLiveWhatIf(npc, step, JSON.stringify(obs)));
    for (const s of r.changedSteps) expect(s).toBeGreaterThanOrEqual(step);
    for (let i = 0; i < step; i++) {
      expect(canonicalJson(r.altTrace.ghosts[i]!.action)).toBe(
        canonicalJson(npc.ghosts[i]!.action),
      );
    }
  });
});

describe("determinism", () => {
  it("same input twice ⟹ identical results", () => {
    const obs = { ...(npc.ghosts[1]!.obs as Record<string, unknown>), playerTrust: 5 };
    const text = JSON.stringify(obs);
    const a = ok(runLiveWhatIf(npc, 1, text));
    const b = ok(runLiveWhatIf(npc, 1, text));
    expect(canonicalJson(a.altTrace)).toBe(canonicalJson(b.altTrace));
    expect(a.diffs).toEqual(b.diffs);
    expect([...a.changedSteps]).toEqual([...b.changedSteps]);
  });

  it("does not mutate the input trace", () => {
    const before = canonicalJson(npc);
    const obs = { ...(npc.ghosts[0]!.obs as Record<string, unknown>), hasLantern: true };
    runLiveWhatIf(npc, 0, JSON.stringify(obs));
    expect(canonicalJson(npc)).toBe(before);
  });

  it("seeded random edits (200 cases): deterministic, bounded, consistent", () => {
    const rng = createRng(2026);
    const actions = [undefined, "offer-lantern", "steal-key", "wait"];
    for (let n = 0; n < 200; n++) {
      const step = rng.int(0, npc.ghosts.length - 1);
      const obs: Record<string, unknown> = {
        ...(npc.ghosts[step]!.obs as Record<string, unknown>),
        playerTrust: rng.int(0, 100),
        hasLantern: rng.int(0, 1) === 1,
        hasRelicKey: rng.int(0, 1) === 1,
        hourOfNight: rng.int(0, 23),
      };
      const act = actions[rng.int(0, actions.length - 1)];
      // parseObservationText requires every field present in the original obs
      // (it has no schema), so "no action" means leaving the field as-is.
      if (act !== undefined) obs["playerAction"] = act;
      const text = JSON.stringify(obs);

      const a = ok(runLiveWhatIf(npc, step, text));
      const b = ok(runLiveWhatIf(npc, step, text));
      expect(canonicalJson(a.altTrace)).toBe(canonicalJson(b.altTrace));
      expect(a.altTrace.ghosts).toHaveLength(npc.ghosts.length);
      expect(a.diffs.map((d) => d.step)).toEqual([...a.changedSteps].sort((x, y) => x - y));
      for (const s of a.changedSteps) expect(s).toBeGreaterThanOrEqual(step);
    }
  });
});

describe("invalid input is rejected", () => {
  const orig = npc.ghosts[0]!.obs;
  const valid = observationToText(orig);

  it("rejects malformed JSON with a message", () => {
    const r = runLiveWhatIf(npc, 0, "{ not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Invalid JSON/);
  });

  it("rejects empty text", () => {
    expect(runLiveWhatIf(npc, 0, "").ok).toBe(false);
  });

  it.each(["[]", "42", "null", '"str"', "true"])("rejects non-object %s", (t) => {
    const r = parseObservationText(t, orig);
    expect(r.ok).toBe(false);
  });

  it("rejects non-finite numbers (1e999)", () => {
    const text = valid.replace(/"playerTrust": [^,\n]+/, '"playerTrust": 1e999');
    const r = parseObservationText(text, orig);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Non-finite/);
  });

  it("rejects a missing required field", () => {
    const o = { ...(orig as Record<string, unknown>) };
    delete o["hasLantern"];
    const r = parseObservationText(JSON.stringify(o), orig);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/hasLantern/);
  });

  it("rejects a field with the wrong type", () => {
    const o = { ...(orig as Record<string, unknown>), playerTrust: "high" };
    const r = parseObservationText(JSON.stringify(o), orig);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/playerTrust/);
  });

  it("rejects out-of-range steps", () => {
    expect(runLiveWhatIf(npc, -1, valid).ok).toBe(false);
    expect(runLiveWhatIf(npc, npc.ghosts.length, valid).ok).toBe(false);
    expect(runLiveWhatIf(npc, 1.5, valid).ok).toBe(false);
  });

  it("never throws on arbitrary garbage (seeded fuzz)", () => {
    const rng = createRng(7);
    const alphabet = '{}[]":,.-+eE0123456789 truefalsnl\n\\';
    for (let i = 0; i < 300; i++) {
      let s = "";
      const len = rng.int(0, 40);
      for (let j = 0; j < len; j++) s += alphabet[rng.int(0, alphabet.length - 1)];
      expect(() => runLiveWhatIf(npc, 0, s)).not.toThrow();
    }
  });
});

describe("unknown agent", () => {
  it("reports live what-if as unavailable", () => {
    const t: Trace = { ...npc, agent: "mystery-agent" };
    const r = runLiveWhatIf(t, 0, observationToText(t.ghosts[0]!.obs));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unavailable/);
  });
});
