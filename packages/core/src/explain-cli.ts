import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { verifyChain } from "./engine.js";
import { explainRun, explainText } from "./explain.js";
import { importTrace } from "./io.js";
import type { Trace } from "./types.js";

/**
 * Explain a trace given as JSON text: either an exported trace file
 * ({ schemaVersion, trace }) or a bare Trace object.
 * Throws on unparseable or structurally invalid input.
 */
export function explainJson(json: string): { text: string; ok: boolean } {
  let candidate: unknown;
  try {
    candidate = JSON.parse(json);
  } catch (e) {
    throw new Error(`invalid JSON: ${(e as Error).message}`);
  }
  const wrapped = typeof candidate === "object" && candidate !== null && "trace" in candidate;
  const file = importTrace<unknown, unknown, unknown>(
    wrapped ? json : JSON.stringify({ schemaVersion: 1, trace: candidate }),
  );
  const trace: Trace<unknown, unknown, unknown> = file.trace;
  const verify = verifyChain(trace);
  return { text: explainText(explainRun(trace, verify)), ok: verify.ok };
}

function main(argv: string[]): number {
  const path = argv[0];
  if (!path) {
    console.error("usage: npm run explain -- <trace.json>");
    return 2;
  }
  try {
    const { text, ok } = explainJson(readFileSync(path, "utf8"));
    console.log(text);
    return ok ? 0 : 1;
  } catch (e) {
    console.error(`explain: ${(e as Error).message}`);
    return 2;
  }
}

// Run only when executed directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
