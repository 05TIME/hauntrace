import { describe, it, expect } from "vitest";
import {
  getBadgeState,
  NO_TRACE_BADGE,
  VERIFYING_BADGE,
} from "../src/getBadgeState.js";

describe("NO_TRACE_BADGE", () => {
  it("has status no-trace", () => {
    expect(NO_TRACE_BADGE.status).toBe("no-trace");
  });
  it("has neutral (empty) cssModifier", () => {
    expect(NO_TRACE_BADGE.cssModifier).toBe("");
  });
  it("label is 'No trace loaded'", () => {
    expect(NO_TRACE_BADGE.label).toBe("No trace loaded");
  });
});

describe("VERIFYING_BADGE", () => {
  it("has status verifying", () => {
    expect(VERIFYING_BADGE.status).toBe("verifying");
  });
  it("has neutral cssModifier", () => {
    expect(VERIFYING_BADGE.cssModifier).toBe("");
  });
});

describe("getBadgeState", () => {
  it("returns verified state when ok is true", () => {
    const state = getBadgeState({ ok: true });
    expect(state.status).toBe("verified");
    expect(state.cssModifier).toBe("verified");
    expect(state.icon).toBe("✅");
    expect(state.label).toBe("Chain verified");
  });

  it("returns broken state when ok is false (no brokenAt, no reason)", () => {
    const state = getBadgeState({ ok: false });
    expect(state.status).toBe("broken");
    expect(state.cssModifier).toBe("broken");
    expect(state.icon).toBe("❌");
    expect(state.label).toBe("Chain broken");
  });

  it("includes step number in label when brokenAt is provided", () => {
    const state = getBadgeState({ ok: false, brokenAt: 3 });
    expect(state.label).toBe("Chain broken at step 3");
  });

  it("includes reason in label when reason is provided", () => {
    const state = getBadgeState({ ok: false, reason: "hash mismatch" });
    expect(state.label).toBe("Chain broken: hash mismatch");
  });

  it("includes both brokenAt and reason in label", () => {
    const state = getBadgeState({ ok: false, brokenAt: 7, reason: "hash mismatch" });
    expect(state.label).toBe("Chain broken at step 7: hash mismatch");
  });

  it("is a pure function — same input always yields same output", () => {
    const r = { ok: false, brokenAt: 1, reason: "bad" };
    expect(getBadgeState(r)).toEqual(getBadgeState(r));
  });
});
