import { describe, it, expect } from "vitest";
import {
  createScrubberState,
  goToStep,
  nextStep,
  prevStep,
  formatTime,
  ruleLabel,
} from "../src/scrubberState.js";
import type { Trace } from "../src/types.js";

function makeTrace(n: number): Trace {
  const ghosts = Array.from({ length: n }, (_, i) => ({
    step: i,
    timeMs: i * 60_000,
    obs: {},
    stateBefore: {},
    ruleId: i === 0 ? "event-surge" : "fallback",
    reason: `step ${i}`,
    action: {},
    stateAfter: {},
    prevHash: "0".repeat(64),
    hash: "a".repeat(64),
  }));
  return {
    agent: "test",
    agentVersion: "1",
    rulesetHash: "a".repeat(64),
    options: { seed: 1, startMs: 0, stepMs: 60_000 },
    ghosts,
    headHash: "a".repeat(64),
  };
}

describe("createScrubberState", () => {
  it("starts at step 0", () => {
    const trace = makeTrace(5);
    const s = createScrubberState(trace);
    expect(s.currentStep).toBe(0);
    expect(s.totalSteps).toBe(5);
    expect(s.currentGhost).toEqual(trace.ghosts[0]);
  });

  it("handles empty trace", () => {
    const trace = makeTrace(0);
    const s = createScrubberState(trace);
    expect(s.currentStep).toBe(0);
    expect(s.totalSteps).toBe(0);
    expect(s.currentGhost).toBeNull();
  });
});

describe("goToStep", () => {
  it("moves to the given step", () => {
    const trace = makeTrace(5);
    const s0 = createScrubberState(trace);
    const s2 = goToStep(s0, trace, 2);
    expect(s2.currentStep).toBe(2);
    expect(s2.currentGhost).toEqual(trace.ghosts[2]);
  });

  it("clamps below 0", () => {
    const trace = makeTrace(5);
    const s0 = createScrubberState(trace);
    const s = goToStep(s0, trace, -5);
    expect(s.currentStep).toBe(0);
  });

  it("clamps above max", () => {
    const trace = makeTrace(5);
    const s0 = createScrubberState(trace);
    const s = goToStep(s0, trace, 100);
    expect(s.currentStep).toBe(4);
  });

  it("rounds fractional steps", () => {
    const trace = makeTrace(5);
    const s0 = createScrubberState(trace);
    const s = goToStep(s0, trace, 2.7);
    expect(s.currentStep).toBe(3);
  });
});

describe("nextStep / prevStep", () => {
  it("nextStep advances by one", () => {
    const trace = makeTrace(3);
    const s0 = createScrubberState(trace);
    const s1 = nextStep(s0, trace);
    expect(s1.currentStep).toBe(1);
  });

  it("nextStep clamps at end", () => {
    const trace = makeTrace(3);
    const s0 = createScrubberState(trace);
    const s2 = goToStep(s0, trace, 2);
    const s3 = nextStep(s2, trace);
    expect(s3.currentStep).toBe(2);
  });

  it("prevStep goes back by one", () => {
    const trace = makeTrace(3);
    const s0 = createScrubberState(trace);
    const s2 = goToStep(s0, trace, 2);
    const s1 = prevStep(s2, trace);
    expect(s1.currentStep).toBe(1);
  });

  it("prevStep clamps at start", () => {
    const trace = makeTrace(3);
    const s0 = createScrubberState(trace);
    const s = prevStep(s0, trace);
    expect(s.currentStep).toBe(0);
  });
});

describe("formatTime", () => {
  it("returns a UTC string", () => {
    const result = formatTime(0);
    expect(result).toContain("UTC");
    expect(result).toContain("1970");
  });

  it("formats known timestamp", () => {
    // 2026-11-30 00:00:00 UTC
    const result = formatTime(Date.UTC(2026, 10, 30));
    expect(result).toContain("2026");
  });
});

describe("ruleLabel", () => {
  it("returns spooky labels for known rules", () => {
    expect(ruleLabel("event-surge")).toContain("🎃");
    expect(ruleLabel("last-minute")).toContain("💀");
    expect(ruleLabel("high-demand")).toContain("👻");
    expect(ruleLabel("weekend")).toContain("🕷️");
    expect(ruleLabel("fallback")).toContain("🦇");
  });

  it("falls back gracefully for unknown rules", () => {
    const label = ruleLabel("unknown-rule");
    expect(label).toContain("unknown-rule");
  });
});
