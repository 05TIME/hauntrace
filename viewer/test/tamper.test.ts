/**
 * Tests for viewer/src/tamper.ts — "Tamper and haunt" mode.
 *
 * Uses the bundled NPC trace JSON (same pattern as chainBreakBadge.test.ts):
 * a real, pre-built trace with valid hashes, so verifyChain exercises genuine
 * SHA-256 comparisons via SubtleCrypto rather than fixture hashes.
 */
import { describe, it, expect } from "vitest";
import {
  tamperTrace,
  restoreTrace,
  hauntedSteps,
  analyzeTrace,
  defaultTamperEdit,
  TAMPER_MARKER,
} from "../src/tamper.js";
import { verifyChain } from "../src/verifyChain.js";
import npcTraceFile from "../src/example-trace-npc.json";
import type { Trace } from "../src/types.js";

const baseTrace = npcTraceFile.trace as unknown as Trace;

describe("tamperTrace / restoreTrace / hauntedSteps / analyzeTrace", () => {
  it("untampered trace is intact: verifyChain ok, no haunted steps", async () => {
    const result = await verifyChain(baseTrace);
    expect(result.ok).toBe(true);
    expect(hauntedSteps(result, baseTrace.ghosts.length).size).toBe(0);

    const analysis = await analyzeTrace(baseTrace);
    expect(analysis.result.ok).toBe(true);
    expect(analysis.badge.status).toBe("verified");
    expect(analysis.hauntedSteps.size).toBe(0);
  });

  it("tampering step k breaks the chain at k (0-based, matches verifyChain.brokenAt)", async () => {
    const k = 2;
    const tampered = tamperTrace(baseTrace, k);
    const result = await verifyChain(tampered);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(k);
  });

  it.each([0, 1, 2, 3, 4, 5])("tampering step %i flags exactly steps >= %i as haunted", async (k) => {
    const tampered = tamperTrace(baseTrace, k);
    const result = await verifyChain(tampered);
    const flagged = hauntedSteps(result, tampered.ghosts.length);

    const expected = new Set<number>();
    for (let i = k; i < tampered.ghosts.length; i++) expected.add(i);

    expect(flagged).toEqual(expected);
    // steps before k are untouched
    for (let i = 0; i < k; i++) expect(flagged.has(i)).toBe(false);
  });

  it("analyzeTrace on a tampered trace reports the broken badge with 1-based step label", async () => {
    const k = 3;
    const tampered = tamperTrace(baseTrace, k);
    const analysis = await analyzeTrace(tampered);
    expect(analysis.result.ok).toBe(false);
    expect(analysis.badge.status).toBe("broken");
    expect(analysis.badge.label).toContain(`step ${k + 1}`);
    expect(analysis.hauntedSteps.has(k)).toBe(true);
    expect(analysis.hauntedSteps.has(k - 1)).toBe(false);
  });

  it("tampering changes the reason by default and appends the tamper marker", () => {
    const k = 1;
    const tampered = tamperTrace(baseTrace, k);
    expect(tampered.ghosts[k]!.reason).toBe(`${baseTrace.ghosts[k]!.reason}${TAMPER_MARKER}`);
    expect(tampered.ghosts[k]!.reason).not.toBe(baseTrace.ghosts[k]!.reason);
  });

  it("an explicit edit can overwrite reason and/or action", () => {
    const k = 1;
    const tampered = tamperTrace(baseTrace, k, { reason: "ghostwritten reason" });
    expect(tampered.ghosts[k]!.reason).toBe("ghostwritten reason");
    // action left as recorded when not supplied
    expect(tampered.ghosts[k]!.action).toEqual(baseTrace.ghosts[k]!.action);

    const tamperedAction = tamperTrace(baseTrace, k, { action: { dialogue: "BOO" } });
    expect(tamperedAction.ghosts[k]!.action).toEqual({ dialogue: "BOO" });
  });

  it("the stored hash and prevHash of the tampered ghost are left untouched (not re-hashed)", () => {
    const k = 2;
    const tampered = tamperTrace(baseTrace, k);
    expect(tampered.ghosts[k]!.hash).toBe(baseTrace.ghosts[k]!.hash);
    expect(tampered.ghosts[k]!.prevHash).toBe(baseTrace.ghosts[k]!.prevHash);
    expect(tampered.headHash).toBe(baseTrace.headHash);
  });

  it("tamperTrace never mutates the original trace", () => {
    const before = structuredClone(baseTrace);
    const k = 0;
    const tampered = tamperTrace(baseTrace, k);
    expect(baseTrace).toEqual(before);
    expect(tampered).not.toBe(baseTrace);
    expect(tampered.ghosts[k]).not.toBe(baseTrace.ghosts[k]);
  });

  it("restoreTrace gives back an intact trace (deep copy, not same reference)", async () => {
    const restored = restoreTrace(baseTrace);
    expect(restored).toEqual(baseTrace);
    expect(restored).not.toBe(baseTrace);
    expect(restored.ghosts).not.toBe(baseTrace.ghosts);

    const result = await verifyChain(restored);
    expect(result.ok).toBe(true);
  });

  it("tamper then restore round-trip: restore always yields an intact chain regardless of prior tampering", async () => {
    const tampered = tamperTrace(baseTrace, 4);
    expect((await verifyChain(tampered)).ok).toBe(false);

    const restored = restoreTrace(baseTrace);
    const result = await verifyChain(restored);
    expect(result.ok).toBe(true);
    expect(hauntedSteps(result, restored.ghosts.length).size).toBe(0);
  });

  it("defaultTamperEdit appends the tamper marker to a given reason", () => {
    const edit = defaultTamperEdit("original reason");
    expect(edit.reason).toBe(`original reason${TAMPER_MARKER}`);
  });

  it("tamperTrace rejects out-of-range or non-integer step indices", () => {
    expect(() => tamperTrace(baseTrace, -1)).toThrow(RangeError);
    expect(() => tamperTrace(baseTrace, baseTrace.ghosts.length)).toThrow(RangeError);
    expect(() => tamperTrace(baseTrace, 1.5)).toThrow(RangeError);
  });
});
