/**
 * One-off script to generate example-trace-npc.json.
 * Run: node dist/apps/haunted-npc/src/generate-trace.js
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { run } from "../../../packages/core/src/index.js";
import { hauntedNpcAgent } from "./agent.js";
import { encounterScript } from "./script.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const opts = { seed: 13, startMs: Date.UTC(2026, 9, 31), stepMs: 60_000 };
const trace = run(hauntedNpcAgent, encounterScript, opts);

const traceFile = { schemaVersion: 1, trace };
const outPath = join(__dirname, "example-trace-npc.json");
writeFileSync(outPath, JSON.stringify(traceFile, null, 2) + "\n", "utf8");
console.log(`Written: ${outPath}`);
console.log(`headHash: ${trace.headHash}`);
