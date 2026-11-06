/**
 * Plain-English explanation of a trace. Pure and dependency-free (no node
 * built-ins, no imports) so the Node CLI and the browser viewer share it.
 * Types are structural: both core and viewer `Trace` shapes are assignable.
 */

export interface ExplainGhost {
  step: number;
  timeMs: number;
  ruleId: string;
  reason: string;
  action: unknown;
}

export interface ExplainTrace {
  agent: string;
  agentVersion: string;
  headHash: string;
  options: { seed: number };
  ghosts: ReadonlyArray<ExplainGhost>;
}

/** Same shape as the engine's VerifyResult. */
export interface ExplainVerify {
  ok: boolean;
  brokenAt?: number;
  reason?: string;
}

export interface Explanation {
  intro: string;
  /** One sentence per step, in order. */
  steps: string[];
  /** Closing line about chain verification. */
  closing: string;
}

const FALLBACK_ID = "fallback";
const MAX_ACTION_CHARS = 160;

function stableJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  const parts: string[] = [];
  for (const k of Object.keys(o).sort()) {
    if (o[k] !== undefined) parts.push(`${JSON.stringify(k)}:${stableJson(o[k])}`);
  }
  return `{${parts.join(",")}}`;
}

function describeAction(action: unknown): string {
  const s = stableJson(action);
  return s.length <= MAX_ACTION_CHARS ? s : `${s.slice(0, MAX_ACTION_CHARS - 1)}…`;
}

function describeTime(timeMs: number): string {
  try {
    return new Date(timeMs).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return `t=${timeMs}ms`;
  }
}

/** Build the step-by-step story. Same inputs always give the same output. */
export function explainRun(trace: ExplainTrace, verify: ExplainVerify): Explanation {
  const n = trace.ghosts.length;
  const intro =
    `Agent "${trace.agent}" v${trace.agentVersion} ran ${n} step${n === 1 ? "" : "s"} ` +
    `with seed ${trace.options.seed}.`;

  const steps = trace.ghosts.map((g, i) => {
    const who =
      g.ruleId === FALLBACK_ID
        ? "no rule matched, so the fallback decided"
        : `rule "${g.ruleId}" fired`;
    return (
      `Step ${i + 1} at ${describeTime(g.timeMs)}: ${who} because ${g.reason}. ` +
      `It chose the action ${describeAction(g.action)}.`
    );
  });

  let closing: string;
  if (verify.ok) {
    closing =
      `The hash chain verifies: all ${n} step${n === 1 ? " is" : "s are"} intact and linked ` +
      `to head hash ${trace.headHash.slice(0, 12)}.`;
  } else {
    const where = verify.brokenAt !== undefined ? ` at step ${verify.brokenAt + 1}` : "";
    const why = verify.reason ? ` (${verify.reason})` : "";
    closing =
      `The hash chain is BROKEN${where}${why}: this trace was altered or corrupted, ` +
      `so do not trust the story above.`;
  }
  return { intro, steps, closing };
}

/** The explanation as one newline-separated text block. */
export function explainText(e: Explanation): string {
  return [e.intro, ...e.steps, e.closing].join("\n");
}
