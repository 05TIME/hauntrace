/**
 * Pure helpers that tie the three viewer features together (share links,
 * Explain this run, tamper/exorcise) around ONE source of truth: the trace that
 * is currently displayed (`state.trace`).
 *
 * - Sharing always encodes exactly the displayed recorded trace, so a tampered
 *   run is shared as that exact broken run (and opens with the broken badge),
 *   and after "Exorcise" the restored trace is what gets shared.
 * - Live what-if edits and scenarios are overlays computed FROM the displayed
 *   trace; they are never part of it, so they are never shared.
 * - The explanation is always built from the displayed trace plus the verify
 *   result computed for that same trace instance.
 *
 * No DOM, no network.
 */
import { analyzeTrace, type TamperAnalysis } from "./tamper.js";
import { explainRun, type Explanation } from "./explainRun.js";
import type { Trace, TraceFile } from "./types.js";

export const TRACE_FILE_SCHEMA_VERSION = 1;

/** The exact file to put into a share link for the displayed trace. */
export function shareableFile(displayed: Trace): TraceFile {
  return { schemaVersion: TRACE_FILE_SCHEMA_VERSION, trace: structuredClone(displayed) };
}

export interface VerifiedRun {
  analysis: TamperAnalysis;
  story: Explanation;
}

/** Verify a trace and explain it using that same verification result. */
export async function verifyAndExplain(displayed: Trace): Promise<VerifiedRun> {
  const analysis = await analyzeTrace(displayed);
  return { analysis, story: explainRun(displayed, analysis.result) };
}
