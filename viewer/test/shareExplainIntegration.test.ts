/**
 * Integration tests (pure modules only, no DOM) for share links + Explain this run
 * composed with tamper / exorcise and live what-if edits, on BOTH bundled traces.
 *
 * Contract (mirrors main.ts, which uses shareableFile/verifyAndExplain):
 *  - A share link carries exactly the displayed recorded trace: the tampered run after
 *    Tamper (opens with a broken chain), the restored run after Exorcise.
 *  - Live what-if edits and scenarios are overlays and never change the shared file
 *    or the explanation.
 *  - The story is built from the trace together with that same trace's verification.
 * DOM wiring (button, panel, stale-result guard) lives in main.ts and is NOT covered.
 */
import { describe, it, expect } from "vitest";
import { shareableFile, verifyAndExplain } from "../src/runState.js";
import { encodeTrace, decodeTrace } from "../src/shareLink.js";
import { explainText } from "../src/explainRun.js";
import { tamperTrace, restoreTrace } from "../src/tamper.js";
import { observationToText, runLiveWhatIf } from "../src/liveWhatIf.js";
import { verifyChain } from "../src/verifyChain.js";
import npcTraceFile from "../src/example-trace-npc.json";
import shortletTraceFile from "../src/example-trace.json";
import type { Trace } from "../src/types.js";

interface Case {
  label: string;
  trace: Trace;
  step: number;
  patch: (obs: Record<string, unknown>) => Record<string, unknown>;
}

const cases: Case[] = [
  {
    label: "shortlet-pricing",
    trace: shortletTraceFile.trace as unknown as Trace,
    step: 0,
    patch: (o) => ({ ...o, localEvent: "Integration-test concert" }),
  },
  {
    label: "haunted-npc",
    trace: npcTraceFile.trace as unknown as Trace,
    step: 5,
    patch: (o) => ({ ...o, hasRelicKey: false }),
  },
];

async function roundTrip(trace: Trace): Promise<Trace> {
  return (await decodeTrace(await encodeTrace(shareableFile(trace)))).trace;
}

function liveText(c: Case, trace: Trace): string {
  return observationToText(c.patch(trace.ghosts[c.step]!.obs as Record<string, unknown>));
}

for (const c of cases) {
  describe(`share + explain + tamper + live: ${c.label}`, () => {
    const tamperSteps = [...new Set([0, c.step, c.trace.ghosts.length - 1])];

    it("original: share round trip is identical and the story says the chain verifies", async () => {
      const file = shareableFile(c.trace);
      expect((await decodeTrace(await encodeTrace(file))).trace).toEqual(c.trace);
      const run = await verifyAndExplain(await roundTrip(c.trace));
      expect(run.analysis.result.ok).toBe(true);
      expect(run.story.steps).toHaveLength(c.trace.ghosts.length);
      expect(run.story.closing).toContain("verifies");
    });

    it("shareableFile copies: mutating it never touches the displayed trace", () => {
      const before = structuredClone(c.trace);
      const file = shareableFile(c.trace);
      file.trace.ghosts[0]!.reason = "mutated";
      expect(c.trace).toEqual(before);
    });

    it.each(tamperSteps)("tampered at step %i: the link opens that EXACT broken run", async (k) => {
      const tampered = tamperTrace(c.trace, k);
      const opened = await roundTrip(tampered);
      expect(opened).toEqual(tampered);
      const run = await verifyAndExplain(opened);
      expect(run.analysis.result.ok).toBe(false);
      expect(run.analysis.result.brokenAt).toBe(k);
      expect(run.analysis.badge.status).toBe("broken");
      expect(run.story.closing).toContain(`BROKEN at step ${k + 1}`);
      expect(run.story.closing).not.toContain("verifies");
      // The story shows the tampered reason, not the original one.
      expect(run.story.steps[k]).toContain(tampered.ghosts[k]!.reason);
    });

    it.each(tamperSteps)("exorcise after tampering step %i: the shared file is the original again", async (k) => {
      const restored = restoreTrace(c.trace); // main.ts: state.trace = restoreTrace(state.original)
      expect(shareableFile(restored)).toEqual(shareableFile(c.trace));
      expect(await encodeTrace(shareableFile(restored))).toBe(await encodeTrace(shareableFile(c.trace)));

      const original = await verifyAndExplain(c.trace);
      const again = await verifyAndExplain(await roundTrip(restored));
      expect(again.analysis.result.ok).toBe(true);
      expect(explainText(again.story)).toBe(explainText(original.story));

      const tamperedStory = explainText((await verifyAndExplain(tamperTrace(c.trace, k))).story);
      expect(tamperedStory).not.toBe(explainText(original.story));
    });

    it("explanations are deterministic and mention every step and rule id", async () => {
      for (const t of [c.trace, tamperTrace(c.trace, c.step)]) {
        const a = explainText((await verifyAndExplain(t)).story);
        const b = explainText((await verifyAndExplain(structuredClone(t))).story);
        expect(a).toBe(b);
        t.ghosts.forEach((g, i) => {
          expect(a).toContain(`Step ${i + 1} `);
          expect(a).toContain(g.ruleId === "fallback" ? "fallback" : `"${g.ruleId}"`);
        });
      }
    });

    it("live edits never change the shared file or the explanation (intact trace)", async () => {
      const payloadBefore = await encodeTrace(shareableFile(c.trace));
      const storyBefore = explainText((await verifyAndExplain(c.trace)).story);

      const live = runLiveWhatIf(c.trace, c.step, liveText(c, c.trace));
      expect(live.ok).toBe(true);
      if (!live.ok) return;
      expect(live.changedSteps.has(c.step)).toBe(true);

      expect(await encodeTrace(shareableFile(c.trace))).toBe(payloadBefore);
      expect(explainText((await verifyAndExplain(c.trace)).story)).toBe(storyBefore);
      // The overlay trace is a separate object and is not what gets shared.
      expect(live.altTrace).not.toBe(c.trace);
    });

    it.each(tamperSteps)("tamper step %i + live edit: sharing still carries the tampered recorded run", async (k) => {
      const tampered = tamperTrace(c.trace, k);
      const payloadBefore = await encodeTrace(shareableFile(tampered));
      const storyBefore = explainText((await verifyAndExplain(tampered)).story);

      const live = runLiveWhatIf(tampered, c.step, liveText(c, tampered));
      expect(live.ok).toBe(true);

      // Live edit afterwards: payload and story are byte-identical.
      expect(await encodeTrace(shareableFile(tampered))).toBe(payloadBefore);
      expect(explainText((await verifyAndExplain(tampered)).story)).toBe(storyBefore);
      const opened = await roundTrip(tampered);
      expect((await verifyChain(opened)).brokenAt).toBe(k);

      // Exorcise (restore the original) while a live edit exists: intact again.
      const restored = restoreTrace(c.trace);
      expect((await verifyAndExplain(restored)).story.closing).toContain("verifies");
    });

    it("a file that was already broken when loaded is restored as loaded (still broken)", async () => {
      const loadedBroken = tamperTrace(c.trace, c.step);
      const original = restoreTrace(loadedBroken); // main.ts: original = restoreTrace(loaded trace)
      const run = await verifyAndExplain(await roundTrip(original));
      expect(shareableFile(original)).toEqual(shareableFile(loadedBroken));
      expect(run.analysis.result.ok).toBe(false);
      expect(run.story.closing).toContain("BROKEN");
    });
  });
}
