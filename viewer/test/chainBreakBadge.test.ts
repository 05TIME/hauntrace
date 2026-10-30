/**
 * Regression test for the Séance chain-break badge off-by-one bug.
 *
 * The bug: verifyChain returns brokenAt as a 0-based step index (matching
 * Ghost.step), but getBadgeState was passing it directly to the label, so
 * tampering step 3 (1-based, timeline label) showed "Chain broken at step 2"
 * instead of "Chain broken at step 3".
 *
 * Fix: getBadgeState adds +1 to brokenAt before formatting the label.
 *
 * Strategy: use the bundled NPC trace JSON (a real, pre-built trace with valid
 * hashes) rather than calling core run(), because the viewer's vitest env
 * aliases node:crypto to a browser shim where createHash throws.
 * The viewer's verifyChain uses SubtleCrypto (async) and works in vitest/jsdom.
 */
import { describe, it, expect } from "vitest";
import { verifyChain } from "../src/verifyChain.js";
import { getBadgeState } from "../src/getBadgeState.js";
import npcTraceFile from "../src/example-trace-npc.json";
import type { Trace } from "../src/types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Deep-clone via JSON round-trip (trace values are JSON-safe by design). */
function cloneTrace(t: Trace): Trace {
  return JSON.parse(JSON.stringify(t)) as Trace;
}

const baseTrace = npcTraceFile.trace as unknown as Trace;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("chain-break badge: 1-based step number (regression)", () => {
  it("bundled NPC trace has 6 steps and passes verifyChain", async () => {
    const result = await verifyChain(baseTrace);
    expect(result.ok).toBe(true);
    expect(baseTrace.ghosts).toHaveLength(6);
  });

  it("tampering ghost at index 2 makes verifyChain return brokenAt=2 (0-based)", async () => {
    const tampered = cloneTrace(baseTrace);
    // Corrupt the hash stored on ghost index 2 (timeline step 3)
    tampered.ghosts[2]!.hash = "deadbeef" + "0".repeat(56);

    const result = await verifyChain(tampered);
    expect(result.ok).toBe(false);
    // Core (and the viewer mirror) returns the 0-based Ghost.step value
    expect(result.brokenAt).toBe(2);
  });

  it("getBadgeState converts brokenAt=2 to 'step 3' — NOT 'step 2' (1-based, matching timeline)", async () => {
    const tampered = cloneTrace(baseTrace);
    tampered.ghosts[2]!.hash = "deadbeef" + "0".repeat(56);

    const verifyResult = await verifyChain(tampered);
    expect(verifyResult.ok).toBe(false);
    expect(verifyResult.brokenAt).toBe(2);   // 0-based from engine

    const badge = getBadgeState(verifyResult);
    expect(badge.status).toBe("broken");
    // The label MUST say "step 3" (1-based), NOT "step 2" (the raw 0-based index)
    expect(badge.label).toContain("step 3");
    expect(badge.label).not.toContain("step 2");
  });

  it("badge label for tampered step 3 matches full format", async () => {
    const tampered = cloneTrace(baseTrace);
    tampered.ghosts[2]!.hash = "deadbeef" + "0".repeat(56);

    const verifyResult = await verifyChain(tampered);
    const badge = getBadgeState(verifyResult);
    // Full label format: "Chain broken at step 3: <reason>"
    expect(badge.label).toMatch(/^Chain broken at step 3/);
  });

  it("tampering the first ghost (index 0) shows 'step 1' in badge", async () => {
    const tampered = cloneTrace(baseTrace);
    tampered.ghosts[0]!.hash = "deadbeef" + "0".repeat(56);

    const verifyResult = await verifyChain(tampered);
    expect(verifyResult.brokenAt).toBe(0);
    const badge = getBadgeState(verifyResult);
    expect(badge.label).toContain("step 1");
    expect(badge.label).not.toContain("step 0");
  });

  it("tampering the last ghost (index 5) shows 'step 6' in badge", async () => {
    const tampered = cloneTrace(baseTrace);
    tampered.ghosts[5]!.hash = "deadbeef" + "0".repeat(56);

    const verifyResult = await verifyChain(tampered);
    // Corrupting the stored hash: verifyChain will catch it via ghostHash check
    expect(verifyResult.brokenAt).toBe(5);
    const badge = getBadgeState(verifyResult);
    expect(badge.label).toContain("step 6");
  });
});
