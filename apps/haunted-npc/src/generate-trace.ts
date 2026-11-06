/**
 * Regenerates apps/haunted-npc/src/example-trace-npc.json AND its viewer copy
 * viewer/src/example-trace-npc.json (the two must stay identical).
 * Run from the repo root: `npm run regen:traces` (or `npm run build && node dist/apps/haunted-npc/src/generate-trace.js`).
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildNpcExampleFile } from "./example-trace.js";

const root = process.cwd();
const appSrc = resolve(root, "apps", "haunted-npc", "src");
const viewerSrc = resolve(root, "viewer", "src");
if (!existsSync(appSrc) || !existsSync(viewerSrc)) throw new Error(`run from the repo root (not found: ${appSrc} or ${viewerSrc})`);

const file = buildNpcExampleFile();
const text = JSON.stringify(file, null, 2) + "\n";
for (const outPath of [resolve(appSrc, "example-trace-npc.json"), resolve(viewerSrc, "example-trace-npc.json")]) {
  writeFileSync(outPath, text, "utf8");
  console.log(`Written: ${outPath}`);
}
console.log(`headHash: ${file.trace.headHash}`);
