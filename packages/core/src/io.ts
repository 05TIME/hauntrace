import { canonicalJson } from "./hash.js";
import type { Ghost, RunOptions, Trace } from "./types.js";

/** The only schema version this implementation produces. */
export const TRACE_SCHEMA_VERSION = 1 as const;

/** Wire format produced by exportTrace and consumed by importTrace. */
export interface TraceFile<S, O, A> {
  schemaVersion: typeof TRACE_SCHEMA_VERSION;
  trace: Trace<S, O, A>;
}

/**
 * Serialise a trace to a JSON string suitable for writing to a file.
 * The output includes `schemaVersion: 1` so consumers can evolve the format.
 *
 * @throws {TypeError} if any value in the trace is not JSON-safe (e.g. NaN, Infinity).
 */
export function exportTrace<S, O, A>(trace: Trace<S, O, A>): string {
  const file: TraceFile<S, O, A> = {
    schemaVersion: TRACE_SCHEMA_VERSION,
    trace,
  };
  // Re-use canonicalJson to guarantee non-finite numbers are rejected early,
  // then re-parse to produce a plain JSON string (canonicalJson sorts keys, which
  // is deterministic but unusual for human-readable output, so we re-serialise
  // with standard JSON.stringify for a more natural ordering).
  canonicalJson(file); // throws if any value is non-finite or un-serialisable
  return JSON.stringify(file, null, 2);
}

/** Validation error thrown by importTrace. */
export class TraceImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceImportError";
  }
}

const SUPPORTED_VERSIONS = new Set<number>([TRACE_SCHEMA_VERSION]);

/**
 * Parse and validate a JSON string that was previously produced by exportTrace.
 *
 * Validation checks:
 * - Valid JSON
 * - `schemaVersion` is present and is a supported version number
 * - `trace` has all required top-level fields with correct types
 * - `trace.options` has `seed`, `startMs`, `stepMs` as finite numbers
 * - `trace.ghosts` is an array; each ghost has all required fields
 * - `trace.headHash` is a 64-char hex string
 *
 * @throws {TraceImportError} on any validation failure.
 */
export function importTrace<S, O, A>(json: string): TraceFile<S, O, A> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new TraceImportError(`invalid JSON: ${(e as Error).message}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TraceImportError("trace file must be a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  // --- schemaVersion ---
  if (!("schemaVersion" in obj)) {
    throw new TraceImportError('missing required field "schemaVersion"');
  }
  const sv = obj["schemaVersion"];
  if (typeof sv !== "number" || !Number.isInteger(sv)) {
    throw new TraceImportError(`"schemaVersion" must be an integer, got ${JSON.stringify(sv)}`);
  }
  if (!SUPPORTED_VERSIONS.has(sv)) {
    throw new TraceImportError(`unsupported schemaVersion ${sv}; supported: ${[...SUPPORTED_VERSIONS].join(", ")}`);
  }

  // --- trace ---
  if (!("trace" in obj)) {
    throw new TraceImportError('missing required field "trace"');
  }
  const rawTrace = obj["trace"];
  if (typeof rawTrace !== "object" || rawTrace === null || Array.isArray(rawTrace)) {
    throw new TraceImportError('"trace" must be an object');
  }
  const t = rawTrace as Record<string, unknown>;

  assertString(t, "agent");
  assertString(t, "agentVersion");
  assertHex64(t, "rulesetHash");
  assertHex64(t, "headHash");
  assertRunOptions(t);
  assertGhosts(t);

  return parsed as TraceFile<S, O, A>;
}

// ---------------------------------------------------------------------------
// Internal validation helpers
// ---------------------------------------------------------------------------

function assertString(obj: Record<string, unknown>, key: string): void {
  if (typeof obj[key] !== "string") {
    throw new TraceImportError(`trace.${key} must be a string, got ${JSON.stringify(obj[key])}`);
  }
}

function assertHex64(obj: Record<string, unknown>, key: string): void {
  assertString(obj, key);
  if (!/^[0-9a-f]{64}$/.test(obj[key] as string)) {
    throw new TraceImportError(`trace.${key} must be a 64-char lowercase hex string`);
  }
}

function assertFiniteNumber(obj: Record<string, unknown>, key: string, prefix: string): void {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new TraceImportError(`${prefix}.${key} must be a finite number, got ${JSON.stringify(v)}`);
  }
}

function assertRunOptions(t: Record<string, unknown>): void {
  if (typeof t["options"] !== "object" || t["options"] === null || Array.isArray(t["options"])) {
    throw new TraceImportError('"trace.options" must be an object');
  }
  const opts = t["options"] as Record<string, unknown>;
  assertFiniteNumber(opts, "seed", "trace.options");
  assertFiniteNumber(opts, "startMs", "trace.options");
  assertFiniteNumber(opts, "stepMs", "trace.options");
}

const HEX64_RE = /^[0-9a-f]{64}$/;

function assertGhosts(t: Record<string, unknown>): void {
  if (!Array.isArray(t["ghosts"])) {
    throw new TraceImportError('"trace.ghosts" must be an array');
  }
  const ghosts = t["ghosts"] as unknown[];
  ghosts.forEach((raw, i) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new TraceImportError(`trace.ghosts[${i}] must be an object`);
    }
    const g = raw as Record<string, unknown>;
    const prefix = `trace.ghosts[${i}]`;

    if (typeof g["step"] !== "number" || !Number.isInteger(g["step"])) {
      throw new TraceImportError(`${prefix}.step must be an integer`);
    }
    if (typeof g["timeMs"] !== "number" || !Number.isFinite(g["timeMs"])) {
      throw new TraceImportError(`${prefix}.timeMs must be a finite number`);
    }
    if (typeof g["ruleId"] !== "string") {
      throw new TraceImportError(`${prefix}.ruleId must be a string`);
    }
    if (typeof g["reason"] !== "string") {
      throw new TraceImportError(`${prefix}.reason must be a string`);
    }
    if (!("obs" in g)) throw new TraceImportError(`${prefix}.obs is missing`);
    if (!("stateBefore" in g)) throw new TraceImportError(`${prefix}.stateBefore is missing`);
    if (!("action" in g)) throw new TraceImportError(`${prefix}.action is missing`);
    if (!("stateAfter" in g)) throw new TraceImportError(`${prefix}.stateAfter is missing`);

    if (typeof g["prevHash"] !== "string" || !HEX64_RE.test(g["prevHash"] as string)) {
      throw new TraceImportError(`${prefix}.prevHash must be a 64-char lowercase hex string`);
    }
    if (typeof g["hash"] !== "string" || !HEX64_RE.test(g["hash"] as string)) {
      throw new TraceImportError(`${prefix}.hash must be a 64-char lowercase hex string`);
    }
  });
}
