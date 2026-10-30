/**
 * formatDiffCard – produces a structured, human-readable summary of a what-if
 * diff card, selected by agent id.
 *
 * Pure functions only; no DOM access, no side-effects.
 *
 * Exported:
 *   formatDiffCard(agentId, diff, origGhost, altGhost) → DiffCardData
 *
 * The caller uses DiffCardData to build the DOM; this module stays testable
 * without a browser.
 */

import type { GhostDiff, Ghost } from "./types.js";

// ── Public output type ───────────────────────────────────────────────────────

export interface DiffCardField {
  /** Human-readable label, e.g. "Dialogue", "Price", "Rule" */
  label: string;
  /** Original (baseline) value string */
  original: string;
  /** Scenario (alt) value string */
  scenario: string;
  /** If true, original is shown crossed-out (value changed) */
  changed: boolean;
}

export interface DiffCardData {
  /** Step index (0-based) */
  step: number;
  /** Short prose title, e.g. "Rule changed: low-trust → high-trust" */
  title: string;
  /** Ordered list of fields to display in the card body */
  fields: DiffCardField[];
  /** Raw observation JSON for the collapsible details toggle */
  rawOrigObs: string;
  rawAltObs: string;
  /** Raw action JSON */
  rawOrigAction: string;
  rawAltAction: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function field(
  label: string,
  orig: unknown,
  alt: unknown,
): DiffCardField {
  const original = str(orig);
  const scenario = str(alt);
  return { label, original, scenario, changed: original !== scenario };
}

// ── Agent-specific formatters ────────────────────────────────────────────────

interface NpcAction {
  dialogue?: unknown;
  moodAfter?: unknown;
  trustChange?: unknown;
}

function formatNpc(diff: GhostDiff, orig: Ghost, alt: Ghost): DiffCardData {
  const ob: NpcAction = (orig.action !== null && typeof orig.action === "object")
    ? (orig.action as NpcAction)
    : {};
  const ab: NpcAction = (alt.action !== null && typeof alt.action === "object")
    ? (alt.action as NpcAction)
    : {};

  const ruleChanged = diff.before.ruleId !== diff.after.ruleId;
  const title = ruleChanged
    ? `Rule changed: ${diff.before.ruleId} → ${diff.after.ruleId}`
    : `Action changed (rule: ${diff.before.ruleId})`;

  return {
    step: diff.step,
    title,
    fields: [
      field("Rule", diff.before.ruleId, diff.after.ruleId),
      field("Mood after", ob.moodAfter, ab.moodAfter),
      field("Trust change", ob.trustChange, ab.trustChange),
      field("Dialogue", ob.dialogue, ab.dialogue),
    ],
    rawOrigObs: JSON.stringify(orig.obs, null, 2),
    rawAltObs: JSON.stringify(alt.obs, null, 2),
    rawOrigAction: JSON.stringify(orig.action, null, 2),
    rawAltAction: JSON.stringify(alt.action, null, 2),
  };
}

interface ShortletAction {
  date?: unknown;
  price?: unknown;
  multiplier?: unknown;
}

function formatShortlet(diff: GhostDiff, orig: Ghost, alt: Ghost): DiffCardData {
  const ob: ShortletAction = (orig.action !== null && typeof orig.action === "object")
    ? (orig.action as ShortletAction)
    : {};
  const ab: ShortletAction = (alt.action !== null && typeof alt.action === "object")
    ? (alt.action as ShortletAction)
    : {};

  const ruleChanged = diff.before.ruleId !== diff.after.ruleId;
  const title = ruleChanged
    ? `Rule changed: ${diff.before.ruleId} → ${diff.after.ruleId}`
    : `Price changed (rule: ${diff.before.ruleId})`;

  const origPrice = typeof ob.price === "number" ? `$${ob.price}` : str(ob.price);
  const altPrice = typeof ab.price === "number" ? `$${ab.price}` : str(ab.price);

  const origMult =
    typeof ob.multiplier === "number" ? `×${ob.multiplier}` : str(ob.multiplier);
  const altMult =
    typeof ab.multiplier === "number" ? `×${ab.multiplier}` : str(ab.multiplier);

  return {
    step: diff.step,
    title,
    fields: [
      field("Rule", diff.before.ruleId, diff.after.ruleId),
      { label: "Price", original: origPrice, scenario: altPrice, changed: origPrice !== altPrice },
      { label: "Multiplier", original: origMult, scenario: altMult, changed: origMult !== altMult },
      field("Date", ob.date, ab.date),
    ],
    rawOrigObs: JSON.stringify(orig.obs, null, 2),
    rawAltObs: JSON.stringify(alt.obs, null, 2),
    rawOrigAction: JSON.stringify(orig.action, null, 2),
    rawAltAction: JSON.stringify(alt.action, null, 2),
  };
}

function formatGeneric(diff: GhostDiff, orig: Ghost, alt: Ghost): DiffCardData {
  const ruleChanged = diff.before.ruleId !== diff.after.ruleId;
  const title = ruleChanged
    ? `Rule changed: ${diff.before.ruleId} → ${diff.after.ruleId}`
    : `Action changed (rule: ${diff.before.ruleId})`;

  // Collect top-level keys from both actions to build generic fields
  const origObj =
    typeof diff.before.action === "object" && diff.before.action !== null
      ? (diff.before.action as Record<string, unknown>)
      : {};
  const altObj =
    typeof diff.after.action === "object" && diff.after.action !== null
      ? (diff.after.action as Record<string, unknown>)
      : {};

  const keys = Array.from(
    new Set([...Object.keys(origObj), ...Object.keys(altObj)]),
  );

  const fields: DiffCardField[] =
    keys.length > 0
      ? [
          field("Rule", diff.before.ruleId, diff.after.ruleId),
          ...keys.map((k) => field(k, origObj[k], altObj[k])),
        ]
      : [
          field("Rule", diff.before.ruleId, diff.after.ruleId),
          field("Action", str(diff.before.action), str(diff.after.action)),
        ];

  return {
    step: diff.step,
    title,
    fields,
    rawOrigObs: JSON.stringify(orig.obs, null, 2),
    rawAltObs: JSON.stringify(alt.obs, null, 2),
    rawOrigAction: JSON.stringify(orig.action, null, 2),
    rawAltAction: JSON.stringify(alt.action, null, 2),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Format a single what-if diff card.
 *
 * @param agentId   The trace's agent identifier string.
 * @param diff      The GhostDiff describing what changed.
 * @param origGhost The original Ghost at diff.step.
 * @param altGhost  The alternate Ghost at diff.step.
 */
export function formatDiffCard(
  agentId: string,
  diff: GhostDiff,
  origGhost: Ghost,
  altGhost: Ghost,
): DiffCardData {
  switch (agentId) {
    case "haunted-npc":
      return formatNpc(diff, origGhost, altGhost);
    case "shortlet-pricing":
      return formatShortlet(diff, origGhost, altGhost);
    default:
      return formatGeneric(diff, origGhost, altGhost);
  }
}
