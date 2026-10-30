/**
 * Pure badge-state derivation for the hash-chain badge.
 *
 * Returns a plain data object so callers can decide how to render it.
 * No DOM, no async – fully testable.
 */

export type BadgeStatus = "no-trace" | "verifying" | "verified" | "broken";

export interface BadgeState {
  status: BadgeStatus;
  /** CSS class appended to the base "meta-hash-badge" class */
  cssModifier: string;
  icon: string;
  label: string;
}

export interface VerifyResult {
  ok: boolean;
  brokenAt?: number;
  reason?: string;
}

/** Neutral state shown before any trace is loaded. */
export const NO_TRACE_BADGE: BadgeState = {
  status: "no-trace",
  cssModifier: "",
  icon: "👻",
  label: "No trace loaded",
};

/** Transient state shown while chain verification is in progress. */
export const VERIFYING_BADGE: BadgeState = {
  status: "verifying",
  cssModifier: "",
  icon: "⏳",
  label: "Verifying chain…",
};

/**
 * Derive a BadgeState from a completed VerifyResult.
 *
 * @param result - the result returned by verifyChain()
 */
export function getBadgeState(result: VerifyResult): BadgeState {
  if (result.ok) {
    return {
      status: "verified",
      cssModifier: "verified",
      icon: "✅",
      label: "Chain verified",
    };
  }
  // brokenAt is 0-based (g.step index from the engine); add 1 so the badge
  // matches the 1-based step numbers shown on the timeline.
  const detail =
    result.brokenAt !== undefined ? ` at step ${result.brokenAt + 1}` : "";
  const reason = result.reason ? `: ${result.reason}` : "";
  return {
    status: "broken",
    cssModifier: "broken",
    icon: "❌",
    label: `Chain broken${detail}${reason}`,
  };
}
