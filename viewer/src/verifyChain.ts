/**
 * Browser-side hash-chain verifier.
 * Mirrors packages/core/src/engine.ts verifyChain but uses async SubtleCrypto.
 */
import { GENESIS_HASH, hashValue } from "./hash.js";
import type { Trace, VerifyResult } from "./types.js";

export async function verifyChain(trace: Trace): Promise<VerifyResult> {
  let prev = GENESIS_HASH;
  for (const g of trace.ghosts) {
    const { hash, ...body } = g;
    if (body.prevHash !== prev) {
      return { ok: false, brokenAt: g.step, reason: "prevHash mismatch" };
    }
    const computed = await hashValue(body);
    if (computed !== hash) {
      return { ok: false, brokenAt: g.step, reason: "hash mismatch" };
    }
    prev = hash;
  }
  if (prev !== trace.headHash) {
    return { ok: false, reason: "headHash mismatch" };
  }
  return { ok: true };
}
