/**
 * Pure startup selection: decide what the viewer loads from the page URL.
 * Precedence: a present `#t=` payload ALWAYS wins over `?example=` and
 * `?whatif=` (a share link must open the shared run, never a sample).
 * An empty or malformed payload is still "share": the caller shows an error
 * instead of silently loading something else.
 */
import { extractPayload } from "./shareLink.js";
import { BUILT_IN_EXAMPLE_KEYS, type BuiltInExampleKey } from "./traceLoader.js";

export type StartupChoice =
  | { kind: "share"; payload: string }
  | { kind: "example"; key: BuiltInExampleKey; whatif: string | undefined }
  | { kind: "none" };

export function selectStartup(search: string, hash: string): StartupChoice {
  const payload = extractPayload(hash);
  if (payload !== null) return { kind: "share", payload };
  const params = new URLSearchParams(search);
  const example = params.get("example");
  if (example !== null && (BUILT_IN_EXAMPLE_KEYS as readonly string[]).includes(example)) {
    return {
      kind: "example",
      key: example as BuiltInExampleKey,
      whatif: params.get("whatif") ?? undefined,
    };
  }
  return { kind: "none" };
}
