import { describe, it, expect, vi, afterEach } from "vitest";
import {
  encodeTrace,
  decodeTrace,
  extractPayload,
  buildShareUrl,
  compressionAvailable,
  ShareLinkError,
  MAX_PAYLOAD_CHARS,
  MAX_DECODED_BYTES,
} from "../src/shareLink.js";
import { GENESIS_HASH, hashValue } from "../src/hash.js";
import { verifyChain } from "../src/verifyChain.js";
import { getBadgeState } from "../src/getBadgeState.js";
import { createRng } from "../../packages/core/src/rng.js";
import exampleRaw from "../src/example-trace.json";
import exampleNpcRaw from "../src/example-trace-npc.json";
import type { Ghost, TraceFile } from "../src/types.js";

/** Build a valid, correctly chained trace from a seed (no randomness besides the seed). */
async function seededTraceFile(seed: number, minSteps = 0): Promise<TraceFile> {
  const rng = createRng(seed);
  const words = ["ghost", "lantern", "naïve", "日本語", "🎃", 'quote"d', "a\nb"];
  const n = rng.int(minSteps, 12);
  const ghosts: Ghost[] = [];
  let prev = GENESIS_HASH;
  for (let i = 0; i < n; i++) {
    const body = {
      step: i,
      timeMs: 1_700_000_000_000 + i * 60_000,
      obs: { n: rng.int(-50, 50), tag: words[rng.int(0, words.length - 1)], f: rng.next() },
      stateBefore: { count: i },
      ruleId: rng.int(0, 1) ? "fallback" : `rule-${rng.int(1, 4)}`,
      reason: `because ${words[rng.int(0, words.length - 1)]}`,
      action: { price: rng.int(60, 200), list: [rng.int(0, 9), null, true] },
      stateAfter: { count: i + 1 },
      prevHash: prev,
    };
    const hash = await hashValue(body);
    ghosts.push({ ...body, hash });
    prev = hash;
  }
  return {
    schemaVersion: 1,
    trace: {
      agent: "seeded",
      agentVersion: "1",
      rulesetHash: "a".repeat(64),
      options: { seed, startMs: 1_700_000_000_000, stepMs: 60_000 },
      ghosts,
      headHash: prev,
    },
  };
}

describe("shareLink round trip", () => {
  it("round-trips the bundled shortlet example", async () => {
    const file = exampleRaw as unknown as TraceFile;
    expect(await decodeTrace(await encodeTrace(file))).toEqual(file);
  });

  it("round-trips the bundled NPC example", async () => {
    const file = exampleNpcRaw as unknown as TraceFile;
    expect(await decodeTrace(await encodeTrace(file))).toEqual(file);
  });

  it("round-trips seeded random traces (compressed and plain)", async () => {
    for (let seed = 1; seed <= 25; seed++) {
      const file = await seededTraceFile(seed);
      expect(await decodeTrace(await encodeTrace(file))).toEqual(file);
      const plain = await encodeTrace(file, { compress: false });
      expect(plain.startsWith("p.")).toBe(true);
      expect(await decodeTrace(plain)).toEqual(file);
    }
  });

  it("is deterministic and URL-fragment safe", async () => {
    const file = await seededTraceFile(7);
    const a = await encodeTrace(file);
    expect(await encodeTrace(file)).toBe(a);
    expect(a).toMatch(/^[zp]\.[A-Za-z0-9_-]+$/);
  });

  it("compresses when available", async () => {
    const file = exampleNpcRaw as unknown as TraceFile;
    const z = await encodeTrace(file);
    const p = await encodeTrace(file, { compress: false });
    if (compressionAvailable()) {
      expect(z.startsWith("z.")).toBe(true);
      expect(z.length).toBeLessThan(p.length);
    }
  });
});

describe("shareLink URL helpers", () => {
  it("builds and extracts a #t= fragment, replacing any old hash", () => {
    const url = buildShareUrl("https://x.test/app/?example=1#old", "z.abc");
    expect(url).toBe("https://x.test/app/?example=1#t=z.abc");
    expect(extractPayload(new URL(url).hash)).toBe("z.abc");
  });

  it("returns null when there is no t param", () => {
    expect(extractPayload("")).toBeNull();
    expect(extractPayload("#other=1")).toBeNull();
  });
});

describe("shareLink rejects bad input", () => {
  const bad: Array<[string, string]> = [
    ["empty", ""],
    ["unknown format", "q.abcd"],
    ["no prefix", "abcdef"],
    ["empty body", "z."],
    ["illegal characters", "p.ab+/=cd"],
    ["impossible base64 length", "p.abcde"],
    ["not compressed data", "z.AAAAAAAA"],
    ["not JSON", "p." + btoa("hello").replace(/=+$/, "")],
    ["JSON but not a trace", "p." + btoa('{"a":1}').replace(/=+$/, "")],
  ];
  for (const [name, payload] of bad) {
    it(`rejects ${name}`, async () => {
      await expect(decodeTrace(payload)).rejects.toBeInstanceOf(ShareLinkError);
    });
  }

  it("rejects an oversized payload without decoding it", async () => {
    await expect(decodeTrace("p." + "A".repeat(MAX_PAYLOAD_CHARS + 1))).rejects.toThrow(/too large/);
  });

  it("rejects a decompression bomb", async () => {
    if (!compressionAvailable()) return;
    // 5 MiB of zeros deflates to a few KB but must expand past the decoded cap.
    const zeros = new Uint8Array(5 * 1024 * 1024);
    const cs = new CompressionStream("deflate-raw");
    const stream = new Blob([zeros]).stream().pipeThrough(cs);
    const packed = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = "";
    packed.forEach((b) => (bin += String.fromCharCode(b)));
    const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await expect(decodeTrace(`z.${b64}`)).rejects.toThrow(/too much data/);
  });

  it("gives a clear message for invalid trace content", async () => {
    const msg = "p." + btoa('{"a":1}').replace(/=+$/, "");
    await expect(decodeTrace(msg)).rejects.toThrow(/valid trace/);
  });
});

describe("tampered share links", () => {
  it("decodes but fails chain verification (broken badge)", async () => {
    const file = await seededTraceFile(3, 2);
    expect(file.trace.ghosts.length).toBeGreaterThan(0);
    expect((await verifyChain(file.trace)).ok).toBe(true);

    // Attacker edits a decision and re-encodes without recomputing hashes.
    const tampered = structuredClone(file);
    tampered.trace.ghosts[0]!.reason = "totally legit";
    const decoded = await decodeTrace(await encodeTrace(tampered));
    const result = await verifyChain(decoded.trace);
    expect(result.ok).toBe(false);
    expect(getBadgeState(result).status).toBe("broken");
  });
});

describe("shareLink encoder robustness", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects JSON over MAX_DECODED_BYTES before compressing", async () => {
    let constructed = 0;
    class CountingCS {
      constructor() {
        constructed++;
        throw new Error("must not be constructed");
      }
    }
    vi.stubGlobal("CompressionStream", CountingCS);
    const file = await seededTraceFile(2, 1);
    file.trace.ghosts[0]!.reason = "x".repeat(MAX_DECODED_BYTES + 1);
    await expect(encodeTrace(file)).rejects.toThrow(/too large/);
    await expect(encodeTrace(file, { compress: false })).rejects.toBeInstanceOf(ShareLinkError);
    expect(constructed).toBe(0);
  });

  it("falls back to plain encoding when deflate-raw is unsupported", async () => {
    class NoDeflateRaw {
      constructor() {
        throw new TypeError("Unsupported compression format: 'deflate-raw'");
      }
    }
    vi.stubGlobal("CompressionStream", NoDeflateRaw);
    const file = await seededTraceFile(5, 2);
    const payload = await encodeTrace(file);
    expect(payload.startsWith("p.")).toBe(true);
    vi.unstubAllGlobals();
    expect(await decodeTrace(payload)).toEqual(file);
  });

  it("falls back to plain encoding when CompressionStream is missing", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    const file = await seededTraceFile(6, 2);
    const payload = await encodeTrace(file);
    expect(payload.startsWith("p.")).toBe(true);
    vi.unstubAllGlobals();
    expect(await decodeTrace(payload)).toEqual(file);
  });

  it("reports a clear error when a z. link cannot be decompressed", async () => {
    const file = await seededTraceFile(8, 2);
    const payload = await encodeTrace(file);
    if (!payload.startsWith("z.")) return;
    class NoDeflateRaw {
      constructor() {
        throw new TypeError("unsupported");
      }
    }
    vi.stubGlobal("DecompressionStream", NoDeflateRaw);
    await expect(decodeTrace(payload)).rejects.toThrow(/cannot decompress/);
  });

  it("never throws anything but ShareLinkError for random garbage payloads", async () => {
    const rng = createRng(99);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_+/=.";
    for (let i = 0; i < 60; i++) {
      const len = rng.int(0, 80);
      let s = rng.int(0, 1) ? "z." : "p.";
      for (let j = 0; j < len; j++) s += alphabet[rng.int(0, alphabet.length - 1)];
      await expect(decodeTrace(s)).rejects.toBeInstanceOf(ShareLinkError);
    }
  });
});
