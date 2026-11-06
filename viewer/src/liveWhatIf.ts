/**
 * liveWhatIf.ts — pure logic for the Séance "Haunt this step" editor.
 *
 * No DOM access. Validates an edited observation, re-runs the trace's agent
 * (via agentRunner) with that observation substituted at one step, and
 * reports which decisions changed.
 */
import { rerunAltTrace } from "./agentRunner.js";
import { computeWhatIfDiffs } from "./whatIfDiff.js";
import { canonicalJson } from "./hash.js";
import type { GhostDiff, Trace } from "./types.js";

export type ParseResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

export type LiveResult =
  | {
      ok: true;
      step: number;
      altTrace: Trace;
      diffs: GhostDiff[];
      changedSteps: Set<number>;
    }
  | { ok: false; error: string };

/** Pretty-printed JSON for the editor text field. */
export function observationToText(obs: unknown): string {
  return JSON.stringify(obs, null, 2) ?? "null";
}

function findNonFinite(v: unknown, path: string): string | null {
  if (typeof v === "number") return Number.isFinite(v) ? null : path;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const bad = findNonFinite(v[i], `${path}[${i}]`);
      if (bad) return bad;
    }
  } else if (v !== null && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      const bad = findNonFinite(x, `${path}.${k}`);
      if (bad) return bad;
    }
  }
  return null;
}

function kindOf(v: unknown): string {
  if (v === null) return "null";
  return Array.isArray(v) ? "array" : typeof v;
}

/**
 * Parse and validate edited observation text against the original observation.
 * Never throws.
 */
export function parseObservationText(text: string, original: unknown): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Invalid JSON: ${msg}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Observation must be a JSON object." };
  }
  const bad = findNonFinite(parsed, "obs");
  if (bad) return { ok: false, error: `Non-finite number at ${bad}.` };

  const value = parsed as Record<string, unknown>;
  if (original !== null && typeof original === "object" && !Array.isArray(original)) {
    for (const [key, orig] of Object.entries(original as Record<string, unknown>)) {
      if (orig === undefined) continue;
      if (!(key in value)) {
        return { ok: false, error: `Missing field "${key}".` };
      }
      const next = value[key];
      const a = kindOf(orig);
      const b = kindOf(next);
      if (a !== b && a !== "null" && b !== "null") {
        return { ok: false, error: `Field "${key}" must be ${a}, got ${b}.` };
      }
    }
  }
  return { ok: true, value };
}

/**
 * Re-run the agent with `text` as the observation at `step`, and diff the
 * result against the original trace. Pure and deterministic.
 */
export function runLiveWhatIf(trace: Trace, step: number, text: string): LiveResult {
  if (!Number.isInteger(step) || step < 0 || step >= trace.ghosts.length) {
    return { ok: false, error: `Step ${step} is out of range.` };
  }
  const original = trace.ghosts[step]?.obs;
  const parsed = parseObservationText(text, original);
  if (!parsed.ok) return parsed;

  const observations = trace.ghosts.map((g, i) => (i === step ? parsed.value : g.obs));

  let altTrace: Trace | null;
  try {
    altTrace = rerunAltTrace(trace.agent, trace, observations);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Agent failed on the edited observation: ${msg}` };
  }
  if (!altTrace) {
    return { ok: false, error: `Live what-if is unavailable for agent "${trace.agent}".` };
  }

  const vm = computeWhatIfDiffs(trace, altTrace);
  // Earlier steps cannot differ (same inputs, same seed); filter as a guard.
  const diffs = vm.diffs.filter((d) => d.step >= step);
  const changedSteps = new Set(diffs.map((d) => d.step));
  return { ok: true, step, altTrace, diffs, changedSteps };
}

/** True when the edited text parses to an observation equal to the original. */
export function isUnedited(text: string, original: unknown): boolean {
  const p = parseObservationText(text, original);
  return p.ok && canonicalJson(p.value) === canonicalJson(original);
}
