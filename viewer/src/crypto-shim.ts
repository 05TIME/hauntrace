/**
 * No-op shim for node:crypto used when bundling agent files in the browser.
 * The viewer's agentRunner never calls sha256/hashValue — it only needs the
 * pure rule/reduce/fallback logic from the agent definitions. This shim
 * satisfies the import without pulling in the Node built-in.
 */
export function createHash(_algo: string): never {
  throw new Error("createHash is not available in the browser");
}
