/**
 * Tests for agentRunner.ts: runRules and rerunAltTrace.
 *
 * Key scenarios tested:
 *  - haunted-npc "npc-has-lantern": step 0 changes from low-trust → lantern-gift
 *  - shortlet-pricing "no-events": step 4 changes from event-surge → weekend
 *
 * These tests use the exact same bundled trace JSON that the viewer loads,
 * confirming that buildAltTrace now produces real decision changes.
 */
import { describe, it, expect } from "vitest";
import { runRules, rerunAltTrace } from "../src/agentRunner.js";
import { computeWhatIfDiffs } from "../src/whatIfDiff.js";
import { getScenariosForAgent } from "../src/scenarioRegistry.js";
import npcTraceFile from "../src/example-trace-npc.json";
import shortletTraceFile from "../src/example-trace.json";
import type { Trace } from "../src/types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function patchTrace(trace: Trace, scenarioId: string): Trace | null {
  const scenario = getScenariosForAgent(trace.agent).find(
    (s) => s.id === scenarioId,
  );
  if (!scenario) return null;
  const patchedObs = trace.ghosts.map((g) =>
    scenario.patchObs(g.obs as Record<string, unknown>),
  );
  return rerunAltTrace(trace.agent, trace, patchedObs);
}

// ── haunted-npc: npc-has-lantern ──────────────────────────────────────────────

describe("haunted-npc / npc-has-lantern scenario", () => {
  const trace = npcTraceFile.trace as unknown as Trace;

  it("trace has 6 steps and step 0 originally fires low-trust", () => {
    expect(trace.ghosts).toHaveLength(6);
    expect(trace.ghosts[0]?.ruleId).toBe("low-trust");
  });

  it("rerunAltTrace returns a non-null alt trace", () => {
    const alt = patchTrace(trace, "npc-has-lantern");
    expect(alt).not.toBeNull();
  });

  it("step 0 changes from low-trust → lantern-gift", () => {
    const alt = patchTrace(trace, "npc-has-lantern")!;
    expect(alt.ghosts[0]?.ruleId).toBe("lantern-gift");
  });

  it("step 0 alt reason mentions warmth granted", () => {
    const alt = patchTrace(trace, "npc-has-lantern")!;
    expect(alt.ghosts[0]?.reason).toContain("warmth granted");
  });

  it("step 0 alt action moodAfter is warm", () => {
    const alt = patchTrace(trace, "npc-has-lantern")!;
    const action = alt.ghosts[0]?.action as { moodAfter: string };
    expect(action.moodAfter).toBe("warm");
  });

  it("computeWhatIfDiffs detects at least one changed step", () => {
    const alt = patchTrace(trace, "npc-has-lantern")!;
    const { diffs, changedSteps } = computeWhatIfDiffs(trace, alt);
    expect(changedSteps.size).toBeGreaterThanOrEqual(1);
    expect(diffs.length).toBeGreaterThanOrEqual(1);
  });

  it("step 0 is in changedSteps", () => {
    const alt = patchTrace(trace, "npc-has-lantern")!;
    const { changedSteps } = computeWhatIfDiffs(trace, alt);
    expect(changedSteps.has(0)).toBe(true);
  });

  it("diff at step 0 shows low-trust → lantern-gift", () => {
    const alt = patchTrace(trace, "npc-has-lantern")!;
    const { diffs } = computeWhatIfDiffs(trace, alt);
    const d = diffs.find((x) => x.step === 0);
    expect(d).toBeDefined();
    expect(d!.before.ruleId).toBe("low-trust");
    expect(d!.after.ruleId).toBe("lantern-gift");
  });

  it("alt trace still has the same number of steps", () => {
    const alt = patchTrace(trace, "npc-has-lantern")!;
    expect(alt.ghosts).toHaveLength(trace.ghosts.length);
  });
});

// ── shortlet-pricing: no-events ───────────────────────────────────────────────

describe("shortlet-pricing / no-events scenario", () => {
  const trace = shortletTraceFile.trace as unknown as Trace;

  it("trace has 5 steps and step 4 originally fires event-surge", () => {
    expect(trace.ghosts).toHaveLength(5);
    expect(trace.ghosts[4]?.ruleId).toBe("event-surge");
  });

  it("rerunAltTrace returns a non-null alt trace", () => {
    const alt = patchTrace(trace, "no-events");
    expect(alt).not.toBeNull();
  });

  it("step 4 changes from event-surge → weekend (isWeekend=true, no event)", () => {
    const alt = patchTrace(trace, "no-events")!;
    // With localEvent=null, event-surge doesn't fire; isWeekend=true → weekend fires
    expect(alt.ghosts[4]?.ruleId).toBe("weekend");
  });

  it("step 4 alt action price is 110 (base 100 × 1.1 weekend)", () => {
    const alt = patchTrace(trace, "no-events")!;
    const action = alt.ghosts[4]?.action as { price: number };
    expect(action.price).toBe(110);
  });

  it("computeWhatIfDiffs detects step 4 as changed", () => {
    const alt = patchTrace(trace, "no-events")!;
    const { changedSteps } = computeWhatIfDiffs(trace, alt);
    expect(changedSteps.has(4)).toBe(true);
  });

  it("diff at step 4 shows event-surge → weekend", () => {
    const alt = patchTrace(trace, "no-events")!;
    const { diffs } = computeWhatIfDiffs(trace, alt);
    const d = diffs.find((x) => x.step === 4);
    expect(d).toBeDefined();
    expect(d!.before.ruleId).toBe("event-surge");
    expect(d!.after.ruleId).toBe("weekend");
  });

  it("steps 0–3 with localEvent=null already null are unchanged", () => {
    const alt = patchTrace(trace, "no-events")!;
    const { changedSteps } = computeWhatIfDiffs(trace, alt);
    // Steps 0–3 had no local events in original, so no change expected
    for (let i = 0; i <= 3; i++) {
      expect(changedSteps.has(i)).toBe(false);
    }
  });

  it("alt trace has same number of steps", () => {
    const alt = patchTrace(trace, "no-events")!;
    expect(alt.ghosts).toHaveLength(trace.ghosts.length);
  });
});

// ── runRules unit tests ────────────────────────────────────────────────────────

import { hauntedNpcAgent } from "../../apps/haunted-npc/src/agent.js";
import type { EncounterObs } from "../../apps/haunted-npc/src/agent.js";
import { shortletPricingAgent } from "../../apps/shortlet-pricing/src/agent.js";
import type { NightObs } from "../../apps/shortlet-pricing/src/agent.js";

describe("runRules", () => {
  it("returns one StepDecision per observation", () => {
    const trace = npcTraceFile.trace as unknown as Trace;
    const observations = trace.ghosts.map((g) => g.obs as EncounterObs);
    const decisions = runRules(hauntedNpcAgent, observations, trace.options);
    expect(decisions).toHaveLength(observations.length);
  });

  it("reproduces the original trace decisions for haunted-npc", () => {
    const trace = npcTraceFile.trace as unknown as Trace;
    const observations = trace.ghosts.map((g) => g.obs as EncounterObs);
    const decisions = runRules(hauntedNpcAgent, observations, trace.options);
    for (let i = 0; i < decisions.length; i++) {
      expect(decisions[i]?.ruleId).toBe(trace.ghosts[i]?.ruleId);
    }
  });

  it("reproduces the original trace decisions for shortlet-pricing", () => {
    const trace = shortletTraceFile.trace as unknown as Trace;
    const observations = trace.ghosts.map((g) => g.obs as NightObs);
    const decisions = runRules(
      shortletPricingAgent,
      observations,
      trace.options,
    );
    for (let i = 0; i < decisions.length; i++) {
      expect(decisions[i]?.ruleId).toBe(trace.ghosts[i]?.ruleId);
    }
  });
});

// ── rerunAltTrace: unknown agent ──────────────────────────────────────────────

describe("rerunAltTrace", () => {
  it("returns null for an unknown agent", () => {
    const trace = npcTraceFile.trace as unknown as Trace;
    const result = rerunAltTrace(
      "unknown-agent",
      trace,
      trace.ghosts.map((g) => g.obs),
    );
    expect(result).toBeNull();
  });

  it("returns a Trace with same step count for haunted-npc", () => {
    const trace = npcTraceFile.trace as unknown as Trace;
    const result = rerunAltTrace(
      "haunted-npc",
      trace,
      trace.ghosts.map((g) => g.obs),
    );
    expect(result).not.toBeNull();
    expect(result!.ghosts).toHaveLength(trace.ghosts.length);
  });

  it("identity patch produces identical ruleIds for shortlet-pricing", () => {
    const trace = shortletTraceFile.trace as unknown as Trace;
    const result = rerunAltTrace(
      "shortlet-pricing",
      trace,
      trace.ghosts.map((g) => g.obs),
    );
    expect(result).not.toBeNull();
    for (let i = 0; i < trace.ghosts.length; i++) {
      expect(result!.ghosts[i]?.ruleId).toBe(trace.ghosts[i]?.ruleId);
    }
  });
});
