/**
 * Integration tests (pure modules only, no DOM): the live what-if editor
 * (liveWhatIf.ts) composed with tamper / restore / chain verification (tamper.ts)
 * on BOTH bundled example traces.
 *
 * Composition contract (mirrors main.ts):
 *  - Live edits only change observations in a re-run COPY; they never touch the
 *    displayed trace, its hashes or its chain verification.
 *  - Tamper only rewrites a recorded reason (no re-hash); it never changes observations,
 *    so live what-if decisions are identical on a tampered trace and on the original.
 *  - Restore returns an intact chain regardless of earlier live edits.
 * DOM-level behaviour (mutual exclusion of live edit and scenarios, step prefill, stale
 * verification guard) lives in main.ts and is NOT covered here.
 */
import { describe, it, expect } from "vitest";
import { observationToText, runLiveWhatIf } from "../src/liveWhatIf.js";
import { tamperTrace, restoreTrace, analyzeTrace, hauntedSteps } from "../src/tamper.js";
import { verifyChain } from "../src/verifyChain.js";
import npcTraceFile from "../src/example-trace-npc.json";
import shortletTraceFile from "../src/example-trace.json";
import type { Trace } from "../src/types.js";

const npc = npcTraceFile.trace as unknown as Trace;
const shortlet = shortletTraceFile.trace as unknown as Trace;

interface Case {
  label: string;
  trace: Trace;
  /** Step to edit, and a patch that is known to change that step's decision. */
  step: number;
  patch: (obs: Record<string, unknown>) => Record<string, unknown>;
}

const cases: Case[] = [
  {
    label: "shortlet-pricing",
    trace: shortlet,
    step: 0,
    // An event beats the last-minute rule (event-surge is evaluated first).
    patch: (o) => ({ ...o, localEvent: "Integration-test concert" }),
  },
  {
    label: "haunted-npc",
    trace: npc,
    step: 5,
    // Betrayal (relic key, trust<20) becomes an ordinary low-trust warning.
    patch: (o) => ({ ...o, hasRelicKey: false }),
  },
];

function liveText(c: Case, trace: Trace = c.trace): string {
  const obs = trace.ghosts[c.step]!.obs as Record<string, unknown>;
  return observationToText(c.patch(obs));
}

function okLive(trace: Trace, step: number, text: string) {
  const r = runLiveWhatIf(trace, step, text);
  expect(r.ok).toBe(true);
  return r as Extract<typeof r, { ok: true }>;
}

for (const c of cases) {
  describe(`live edit + tamper/restore: ${c.label}`, () => {
    const n = c.trace.ghosts.length;

    it("the bundled trace is intact and the edit really changes a decision", async () => {
      expect((await verifyChain(c.trace)).ok).toBe(true);
      const r = okLive(c.trace, c.step, liveText(c));
      expect(r.changedSteps.has(c.step)).toBe(true);
      for (const s of r.changedSteps) expect(s).toBeGreaterThanOrEqual(c.step);
    });

    it("a live edit never mutates the trace and leaves the chain verified", async () => {
      const before = structuredClone(c.trace);
      okLive(c.trace, c.step, liveText(c));
      expect(c.trace).toEqual(before);
      const analysis = await analyzeTrace(c.trace);
      expect(analysis.result.ok).toBe(true);
      expect(analysis.hauntedSteps.size).toBe(0);
    });

    it.each([0, 1, 2, 3, 4, 5])("tampering step %i does not change live what-if decisions", (k) => {
      if (k >= n) return;
      const baseline = okLive(c.trace, c.step, liveText(c));
      const tampered = tamperTrace(c.trace, k);
      // Same edited text (observations are untouched by tamper).
      const after = okLive(tampered, c.step, liveText(c, tampered));
      expect(liveText(c, tampered)).toBe(liveText(c));
      expect([...after.changedSteps]).toEqual([...baseline.changedSteps]);
      expect(after.diffs.map((d) => [d.step, d.before.ruleId, d.after.ruleId, d.after.action])).toEqual(
        baseline.diffs.map((d) => [d.step, d.before.ruleId, d.after.ruleId, d.after.action]),
      );
    });

    it.each([0, 1, 2, 3, 4, 5])("live edit after tampering step %i keeps the break at %i", async (k) => {
      if (k >= n) return;
      const tampered = tamperTrace(c.trace, k);
      const tamperedBefore = structuredClone(tampered);
      okLive(tampered, c.step, liveText(c));
      // Live editing neither repairs nor worsens the tampered trace.
      expect(tampered).toEqual(tamperedBefore);
      const analysis = await analyzeTrace(tampered);
      expect(analysis.result.ok).toBe(false);
      expect(analysis.result.brokenAt).toBe(k);
      expect([...analysis.hauntedSteps].sort((a, b) => a - b)).toEqual(
        Array.from({ length: n - k }, (_, i) => k + i),
      );
      expect(analysis.badge.label).toContain(`step ${k + 1}`);
    });

    it("unedited text yields zero diffs on a tampered trace", () => {
      const tampered = tamperTrace(c.trace, c.step);
      const text = observationToText(tampered.ghosts[c.step]!.obs);
      const r = okLive(tampered, c.step, text);
      expect(r.diffs).toEqual([]);
      expect(r.changedSteps.size).toBe(0);
    });

    it("restore after tamper + live edit gives an intact chain and the same live result as the original", async () => {
      const tampered = tamperTrace(c.trace, c.step);
      okLive(tampered, c.step, liveText(c));
      expect((await verifyChain(tampered)).ok).toBe(false);

      const restored = restoreTrace(c.trace);
      const analysis = await analyzeTrace(restored);
      expect(analysis.result.ok).toBe(true);
      expect(analysis.badge.label).toBe("Chain verified");
      expect(hauntedSteps(analysis.result, n).size).toBe(0);

      const a = okLive(c.trace, c.step, liveText(c));
      const b = okLive(restored, c.step, liveText(c, restored));
      expect([...b.changedSteps]).toEqual([...a.changedSteps]);
    });

    it("invalid live text is rejected without affecting tamper analysis", async () => {
      const tampered = tamperTrace(c.trace, 1);
      const bad = runLiveWhatIf(tampered, c.step, "{ not json");
      expect(bad.ok).toBe(false);
      const analysis = await analyzeTrace(tampered);
      expect(analysis.result.brokenAt).toBe(1);
    });

    it("re-tampering always starts from the original: one tampered step at a time", async () => {
      const first = tamperTrace(c.trace, 0);
      const second = tamperTrace(c.trace, Math.min(2, n - 1)); // viewer always tampers from `original`
      expect(first.ghosts[Math.min(2, n - 1)]!.reason).toBe(c.trace.ghosts[Math.min(2, n - 1)]!.reason);
      expect((await verifyChain(second)).brokenAt).toBe(Math.min(2, n - 1));
    });
  });
}
