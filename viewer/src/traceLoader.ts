/**
 * Parses and validates trace JSON files produced by exportTrace.
 * Runs entirely in the browser - no Node.js dependencies.
 */
import type { TraceFile } from "./types.js";

export class TraceLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceLoadError";
  }
}

const HEX64_RE = /^[0-9a-f]{64}$/;
const SUPPORTED_VERSIONS = new Set([1]);

export function parseTraceFile(json: string): TraceFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new TraceLoadError(`Invalid JSON: ${(e as Error).message}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TraceLoadError("Trace file must be a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  const sv = obj["schemaVersion"];
  if (typeof sv !== "number" || !Number.isInteger(sv)) {
    throw new TraceLoadError(`"schemaVersion" must be an integer, got ${JSON.stringify(sv)}`);
  }
  if (!SUPPORTED_VERSIONS.has(sv)) {
    throw new TraceLoadError(`Unsupported schemaVersion ${sv}; supported: ${[...SUPPORTED_VERSIONS].join(", ")}`);
  }

  const rawTrace = obj["trace"];
  if (typeof rawTrace !== "object" || rawTrace === null || Array.isArray(rawTrace)) {
    throw new TraceLoadError('"trace" must be an object');
  }
  const t = rawTrace as Record<string, unknown>;

  assertString(t, "agent");
  assertString(t, "agentVersion");
  assertHex64(t, "rulesetHash");
  assertHex64(t, "headHash");
  assertRunOptions(t);
  assertGhosts(t);

  return parsed as TraceFile;
}

function assertString(obj: Record<string, unknown>, key: string): void {
  if (typeof obj[key] !== "string") {
    throw new TraceLoadError(`trace.${key} must be a string, got ${JSON.stringify(obj[key])}`);
  }
}

function assertHex64(obj: Record<string, unknown>, key: string): void {
  assertString(obj, key);
  if (!HEX64_RE.test(obj[key] as string)) {
    throw new TraceLoadError(`trace.${key} must be a 64-char lowercase hex string`);
  }
}

function assertFiniteNumber(obj: Record<string, unknown>, key: string, prefix: string): void {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new TraceLoadError(`${prefix}.${key} must be a finite number, got ${JSON.stringify(v)}`);
  }
}

function assertRunOptions(t: Record<string, unknown>): void {
  if (typeof t["options"] !== "object" || t["options"] === null || Array.isArray(t["options"])) {
    throw new TraceLoadError('"trace.options" must be an object');
  }
  const opts = t["options"] as Record<string, unknown>;
  assertFiniteNumber(opts, "seed", "trace.options");
  assertFiniteNumber(opts, "startMs", "trace.options");
  assertFiniteNumber(opts, "stepMs", "trace.options");
}

function assertGhosts(t: Record<string, unknown>): void {
  if (!Array.isArray(t["ghosts"])) {
    throw new TraceLoadError('"trace.ghosts" must be an array');
  }
  (t["ghosts"] as unknown[]).forEach((raw, i) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new TraceLoadError(`trace.ghosts[${i}] must be an object`);
    }
    const g = raw as Record<string, unknown>;
    const prefix = `trace.ghosts[${i}]`;

    if (typeof g["step"] !== "number" || !Number.isInteger(g["step"])) {
      throw new TraceLoadError(`${prefix}.step must be an integer`);
    }
    if (typeof g["timeMs"] !== "number" || !Number.isFinite(g["timeMs"])) {
      throw new TraceLoadError(`${prefix}.timeMs must be a finite number`);
    }
    if (typeof g["ruleId"] !== "string") throw new TraceLoadError(`${prefix}.ruleId must be a string`);
    if (typeof g["reason"] !== "string") throw new TraceLoadError(`${prefix}.reason must be a string`);
    if (!("obs" in g)) throw new TraceLoadError(`${prefix}.obs is missing`);
    if (!("stateBefore" in g)) throw new TraceLoadError(`${prefix}.stateBefore is missing`);
    if (!("action" in g)) throw new TraceLoadError(`${prefix}.action is missing`);
    if (!("stateAfter" in g)) throw new TraceLoadError(`${prefix}.stateAfter is missing`);
    if (typeof g["prevHash"] !== "string" || !HEX64_RE.test(g["prevHash"] as string)) {
      throw new TraceLoadError(`${prefix}.prevHash must be a 64-char lowercase hex string`);
    }
    if (typeof g["hash"] !== "string" || !HEX64_RE.test(g["hash"] as string)) {
      throw new TraceLoadError(`${prefix}.hash must be a 64-char lowercase hex string`);
    }
  });
}
