/**
 * Pure logic for Séance "Tamper and haunt" mode.
 *
 * Tampering edits the recorded reason/action of ONE ghost WITHOUT re-hashing it,
 * so the hash chain must break at that step. Every later step is then "haunted":
 * its own stored hash may still be self-consistent, but it sits on a broken chain
 * and can no longer be trusted.
 *
 * No DOM. All step indices are 0-based (matching Ghost.step and verifyChain's
 * brokenAt); only the badge label is 1-based, via getBadgeState.
 */
import type { Trace, VerifyResult } from "./types.js";
import { verifyChain } from "./verifyChain.js";
import { getBadgeState, type BadgeState } from "./getBadgeState.js";

/** Fields of a ghost the user may overwrite. Omitted fields are left as recorded. */
export interface TamperEdit {
  reason?: string;
  action?: unknown;
}

/** Marker appended to a reason when no explicit edit is given. */
export const TAMPER_MARKER = " [tampered]";

export interface TamperAnalysis {
  result: VerifyResult;
  badge: BadgeState;
  /** 0-based indices of every step flagged haunted/broken (brokenAt and later). */
  hauntedSteps: Set<number>;
}

/** Deep copy so callers can never alias (and so never mutate) the original. */
function cloneTrace(trace: Trace): Trace {
  return structuredClone(trace);
}

/** A default edit that is guaranteed to change the hashed body of `ghost`. */
export function defaultTamperEdit(reason: string): TamperEdit {
  return { reason: `${reason}${TAMPER_MARKER}` };
}

/**
 * Return a COPY of `original` in which ghost `stepIndex` has its reason and/or
 * action overwritten. Hashes (ghost.hash, headHash) are deliberately NOT updated.
 * The input trace is never mutated.
 *
 * @throws RangeError if stepIndex is not an integer inside the trace.
 */
export function tamperTrace(original: Trace, stepIndex: number, edit?: TamperEdit): Trace {
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= original.ghosts.length) {
    throw new RangeError(`tamper step ${stepIndex} out of range (0..${original.ghosts.length - 1})`);
  }
  const copy = cloneTrace(original);
  const ghost = copy.ghosts[stepIndex]!;
  const effective = edit ?? defaultTamperEdit(ghost.reason);
  if (effective.reason !== undefined) ghost.reason = effective.reason;
  if ("action" in effective && effective.action !== undefined) {
    ghost.action = structuredClone(effective.action);
  }
  return copy;
}

/** "Exorcise": a fresh copy of the original trace, ready to verify as intact. */
export function restoreTrace(original: Trace): Trace {
  return cloneTrace(original);
}

/**
 * Steps flagged haunted for a verify result: the break and everything after it.
 * Empty when the chain is intact, or when the break is not attributable to a
 * step (e.g. headHash mismatch: no step is flagged, the badge still reports it).
 */
export function hauntedSteps(result: VerifyResult, totalSteps: number): Set<number> {
  const out = new Set<number>();
  if (result.ok || result.brokenAt === undefined) return out;
  for (let i = Math.max(0, result.brokenAt); i < totalSteps; i++) out.add(i);
  return out;
}

/** Verify a trace and derive the badge plus the set of haunted steps. */
export async function analyzeTrace(trace: Trace): Promise<TamperAnalysis> {
  const result = await verifyChain(trace);
  return {
    result,
    badge: getBadgeState(result),
    hauntedSteps: hauntedSteps(result, trace.ghosts.length),
  };
}
