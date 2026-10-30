/**
 * What-if diff view-model: computes which ghosts differ between
 * the original trace and an alternate trace produced by a patch.
 */
import type { GhostDiff, Trace } from "./types.js";
import { canonicalJson } from "./hash.js";

export interface WhatIfViewModel {
  altTrace: Trace;
  diffs: GhostDiff[];
  /** Steps that changed, as a Set for fast lookup */
  changedSteps: Set<number>;
}

/**
 * Computes diffs between the original and an alternative trace.
 * Both traces must have the same length.
 */
export function computeWhatIfDiffs(original: Trace, alt: Trace): WhatIfViewModel {
  const diffs: GhostDiff[] = [];
  const changedSteps = new Set<number>();

  const len = Math.min(original.ghosts.length, alt.ghosts.length);
  for (let i = 0; i < len; i++) {
    const o = original.ghosts[i];
    const a = alt.ghosts[i];
    if (!o || !a) continue;
    const actionChanged =
      canonicalJson(o.action) !== canonicalJson(a.action) || o.ruleId !== a.ruleId;
    if (actionChanged) {
      diffs.push({
        step: i,
        before: { ruleId: o.ruleId, action: o.action, reason: o.reason },
        after: { ruleId: a.ruleId, action: a.action, reason: a.reason },
      });
      changedSteps.add(i);
    }
  }

  return { altTrace: alt, diffs, changedSteps };
}

/**
 * Formats a diff for display in the what-if overlay.
 */
export function formatDiff(diff: GhostDiff): string {
  const before = `${diff.before.ruleId}: ${JSON.stringify(diff.before.action)}`;
  const after = `${diff.after.ruleId}: ${JSON.stringify(diff.after.action)}`;
  return `Step ${diff.step}: ${before} → ${after}`;
}
