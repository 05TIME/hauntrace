/**
 * Shareable ghost links: encode a trace file into a compact URL fragment
 * (#t=<payload>) and decode it back. No network, browser-safe.
 *
 * Payload format: "<mode>.<base64url>" where mode is
 *   "z" = UTF-8 JSON compressed with deflate-raw (CompressionStream)
 *   "p" = UTF-8 JSON, uncompressed (used when CompressionStream is missing)
 *
 * Decoding validates the structure only (parseTraceFile). Hash-chain
 * verification is deliberately left to the normal load path, so a tampered
 * link decodes fine and then shows the broken badge.
 */
import { parseTraceFile, TraceLoadError } from "./traceLoader.js";
import type { TraceFile } from "./types.js";

/** Longest accepted payload (characters, after the "z."/"p." prefix). */
export const MAX_PAYLOAD_CHARS = 200_000;
/** Longest accepted decoded JSON (bytes); guards against decompression bombs. */
export const MAX_DECODED_BYTES = 2 * 1024 * 1024;

export class ShareLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareLinkError";
  }
}

const B64URL_RE = /^[A-Za-z0-9_-]+$/;

// ── base64url ────────────────────────────────────────────────

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  if (!B64URL_RE.test(s) || s.length % 4 === 1) {
    throw new ShareLinkError("Share link is malformed (bad encoding).");
  }
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  let bin: string;
  try {
    bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  } catch {
    throw new ShareLinkError("Share link is malformed (bad encoding).");
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── compression ──────────────────────────────────────────────

/** True when this runtime can both compress and decompress. */
export function compressionAvailable(): boolean {
  return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
}

async function pipe(
  input: Uint8Array,
  transform: { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> },
  maxBytes: number,
  tooBig: string,
): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  // Do not await the write: backpressure would deadlock until we start reading.
  const written = writer.write(input).then(() => writer.close());
  // If the reader fails first (corrupt data, size cap), avoid an unhandled rejection.
  written.catch(() => undefined);
  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ShareLinkError(tooBig);
      }
      chunks.push(value);
    }
    await written;
  } catch (e) {
    if (e instanceof ShareLinkError) throw e;
    throw new ShareLinkError("Share link is malformed (corrupt compressed data).");
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

// ── public API ───────────────────────────────────────────────

function makeDecompressor(): Parameters<typeof pipe>[1] {
  try {
    return new DecompressionStream("deflate-raw") as unknown as Parameters<typeof pipe>[1];
  } catch {
    throw new ShareLinkError("This browser cannot decompress share links.");
  }
}

/**
 * Encode a trace file into a link payload (the part after "#t=").
 * Compresses with deflate-raw when supported; if CompressionStream is missing
 * or rejects "deflate-raw", it falls back to plain ("p.") encoding.
 * @throws ShareLinkError if the JSON exceeds MAX_DECODED_BYTES (checked before
 *   compressing) or the payload would exceed MAX_PAYLOAD_CHARS.
 */
export async function encodeTrace(
  file: TraceFile,
  opts: { compress?: boolean } = {},
): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(file));
  if (json.length > MAX_DECODED_BYTES) {
    throw new ShareLinkError(
      "Trace is too large to share as a link. Export the trace file instead.",
    );
  }
  let mode: "z" | "p" = "p";
  let body: Uint8Array = json;
  if ((opts.compress ?? true) && compressionAvailable()) {
    try {
      body = await pipe(
        json,
        new CompressionStream("deflate-raw") as unknown as Parameters<typeof pipe>[1],
        MAX_DECODED_BYTES,
        "Trace is too large to share as a link.",
      );
      mode = "z";
    } catch {
      // deflate-raw unsupported (or stream failed): fall back to plain encoding.
      body = json;
      mode = "p";
    }
  }
  const payload = `${mode}.${toBase64Url(body)}`;
  if (payload.length - 2 > MAX_PAYLOAD_CHARS) {
    throw new ShareLinkError(
      "Trace is too large to share as a link. Export the trace file instead.",
    );
  }
  return payload;
}

/**
 * Decode a link payload back into a validated TraceFile.
 * @throws ShareLinkError on malformed, oversized or structurally invalid input.
 */
export async function decodeTrace(payload: string): Promise<TraceFile> {
  const mode = payload.slice(0, 2);
  const data = payload.slice(2);
  if (mode !== "z." && mode !== "p.") {
    throw new ShareLinkError("Share link is malformed (unknown format).");
  }
  if (data.length === 0) throw new ShareLinkError("Share link is empty.");
  if (data.length > MAX_PAYLOAD_CHARS) {
    throw new ShareLinkError("Share link is too large to load.");
  }
  let bytes = fromBase64Url(data);
  if (mode === "z.") {
    if (!compressionAvailable()) {
      throw new ShareLinkError("This browser cannot decompress share links.");
    }
    bytes = await pipe(
      bytes,
      makeDecompressor(),
      MAX_DECODED_BYTES,
      "Share link expands to too much data.",
    );
  } else if (bytes.length > MAX_DECODED_BYTES) {
    throw new ShareLinkError("Share link is too large to load.");
  }
  let json: string;
  try {
    json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ShareLinkError("Share link is malformed (not valid text).");
  }
  try {
    return parseTraceFile(json);
  } catch (e) {
    const msg = e instanceof TraceLoadError ? e.message : String(e);
    throw new ShareLinkError(`Share link does not contain a valid trace: ${msg}`);
  }
}

/** Extract the payload from a location hash like "#t=abc", or null if absent. */
export function extractPayload(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const part of raw.split("&")) {
    if (part.startsWith("t=")) return part.slice(2);
  }
  return null;
}

/** Build a full share URL from a base URL (any existing hash is replaced). */
export function buildShareUrl(baseHref: string, payload: string): string {
  const i = baseHref.indexOf("#");
  const base = i === -1 ? baseHref : baseHref.slice(0, i);
  return `${base}#t=${payload}`;
}
