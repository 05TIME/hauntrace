import { describe, it, expect } from "vitest";
import { computeWhatIfDiffs, formatDiff } from "../src/whatIfDiff.js";
import type { Trace } from "../src/types.js";

function makeGhost(
  step: number,
  ruleId: string,
  action: unknown,
  reason = "test",
) {
  return {
    step,
    timeMs: step * 1000,
    obs: { x: step },
    stateBefore: {},
    ruleId,
    reason,
    action,
    stateAfter: {},
    prevHash: "0".repeat(64),
    hash: "a".repeat(64),
  };
}

function makeTrace(ghosts: ReturnType<typeof makeGhost>[]): Trace {
  return {
    agent: "test",
    agentVersion: "1",
    rulesetHash: "a".repeat(64),
    options: { seed: 1, startMs: 0, stepMs: 1000 },
    ghosts,
    headHash: "a".repeat(64),
  };
}

describe("computeWhatIfDiffs", () => {
  it("returns empty diffs for identical traces", () => {
    const orig = makeTrace([
      makeGhost(0, "r1", { price: 100 }),
      makeGhost(1, "r2", { price: 110 }),
    ]);
    const alt = makeTrace([
      makeGhost(0, "r1", { price: 100 }),
      makeGhost(1, "r2", { price: 110 }),
    ]);
    const result = computeWhatIfDiffs(orig, alt);
    expect(result.diffs).toHaveLength(0);
    expect(result.changedSteps.size).toBe(0);
  });

  it("detects action change at step 0", () => {
    const orig = makeTrace([
      makeGhost(0, "r1", { price: 100 }),
      makeGhost(1, "r2", { price: 110 }),
    ]);
    const alt = makeTrace([
      makeGhost(0, "r1", { price: 120 }), // changed
      makeGhost(1, "r2", { price: 110 }),
    ]);
    const result = computeWhatIfDiffs(orig, alt);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]?.step).toBe(0);
    expect(result.changedSteps.has(0)).toBe(true);
  });

  it("detects rule id change", () => {
    const orig = makeTrace([makeGhost(0, "r1", { price: 100 })]);
    const alt = makeTrace([makeGhost(0, "r2", { price: 100 })]);
    const result = computeWhatIfDiffs(orig, alt);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]?.before.ruleId).toBe("r1");
    expect(result.diffs[0]?.after.ruleId).toBe("r2");
  });

  it("detects multiple changed steps", () => {
    const orig = makeTrace([
      makeGhost(0, "r1", { price: 100 }),
      makeGhost(1, "r1", { price: 100 }),
      makeGhost(2, "r1", { price: 100 }),
    ]);
    const alt = makeTrace([
      makeGhost(0, "r1", { price: 100 }),        // unchanged
      makeGhost(1, "r2", { price: 120 }),        // changed
      makeGhost(2, "r3", { price: 130 }),        // changed
    ]);
    const result = computeWhatIfDiffs(orig, alt);
    expect(result.diffs).toHaveLength(2);
    expect(result.changedSteps.has(1)).toBe(true);
    expect(result.changedSteps.has(2)).toBe(true);
    expect(result.changedSteps.has(0)).toBe(false);
  });

  it("handles traces of different lengths (uses shorter)", () => {
    const orig = makeTrace([
      makeGhost(0, "r1", { price: 100 }),
      makeGhost(1, "r1", { price: 100 }),
    ]);
    const alt = makeTrace([makeGhost(0, "r1", { price: 100 })]);
    const result = computeWhatIfDiffs(orig, alt);
    expect(result.diffs).toHaveLength(0);
  });
});

describe("formatDiff", () => {
  it("formats a diff with step, before and after", () => {
    const diff = {
      step: 3,
      before: { ruleId: "r1", action: { price: 100 }, reason: "old" },
      after: { ruleId: "r2", action: { price: 120 }, reason: "new" },
    };
    const result = formatDiff(diff);
    expect(result).toContain("Step 3");
    expect(result).toContain("r1");
    expect(result).toContain("r2");
    expect(result).toContain("→");
  });
});
