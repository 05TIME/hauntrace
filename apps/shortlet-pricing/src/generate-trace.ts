/**
 * Regenerates viewer/src/example-trace.json (shortlet-pricing, EXAMPLE data).
 * Run from the repo root: `npm run regen:traces` (or `npm run build && node dist/apps/shortlet-pricing/src/generate-trace.js`).
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildShortletExampleFile } from "./example-trace.js";

const viewerSrc = resolve(process.cwd(), "viewer", "src");
if (!existsSync(viewerSrc)) throw new Error(`run from the repo root: ${viewerSrc} not found`);

const file = buildShortletExampleFile();
const outPath = resolve(viewerSrc, "example-trace.json");
writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n", "utf8");
console.log(`Written: ${outPath}`);
console.log(`headHash: ${file.trace.headHash}`);
