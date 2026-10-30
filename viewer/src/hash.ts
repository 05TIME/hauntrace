/**
 * Browser-compatible SHA-256 using the Web Crypto API (SubtleCrypto).
 * Mirrors the canonicalJson + hashValue from packages/core/src/hash.ts
 * but without node:crypto.
 */

export const GENESIS_HASH = "0".repeat(64);

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

/** Async SHA-256 via SubtleCrypto – available in all modern browsers. */
export async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashValue(value: unknown): Promise<string> {
  return sha256(canonicalJson(value));
}
