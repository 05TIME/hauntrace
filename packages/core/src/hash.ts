import { createHash } from "node:crypto";

/** Deterministic JSON: object keys sorted, undefined dropped, non-finite numbers rejected. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(v: unknown): unknown {
  if (v === null || typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new TypeError(`non-finite number in trace: ${v}`);
    return Object.is(v, -0) ? 0 : v;
  }
  if (Array.isArray(v)) return v.map(normalize);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined) out[k] = normalize(x);
    }
    return out;
  }
  throw new TypeError(`unsupported value in trace: ${typeof v}`);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function hashValue(value: unknown): string {
  return sha256(canonicalJson(value));
}

export const GENESIS_HASH = "0".repeat(64);
