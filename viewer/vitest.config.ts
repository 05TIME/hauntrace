import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "..");

// Resolve a source file in the repo tree.
const src = (pkg: string, file: string) =>
  path.resolve(repo, pkg, file);

// Build an alias entry that maps the absolute resolved .js path → .ts source.
// Vitest resolves relative imports to absolute paths before alias matching,
// so we alias on the absolute path (no regex needed, no fragile suffix matching).
const abs = (pkg: string, file: string) => ({
  find: src(pkg, file.replace(/\.ts$/, ".js")),
  replacement: src(pkg, file),
});

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: [
      // ── node:crypto shim ───────────────────────────────────────────────
      // agentRunner never calls sha256/hashValue at runtime; this satisfies
      // the import without pulling in the Node built-in.
      {
        find: "node:crypto",
        replacement: path.resolve(__dirname, "src/crypto-shim.ts"),
      },

      // ── packages/core ──────────────────────────────────────────────────
      abs("packages/core/src", "index.ts"),
      abs("packages/core/src", "engine.ts"),
      abs("packages/core/src", "hash.ts"),
      abs("packages/core/src", "rng.ts"),
      abs("packages/core/src", "clock.ts"),
      abs("packages/core/src", "types.ts"),

      // ── apps/haunted-npc ───────────────────────────────────────────────
      abs("apps/haunted-npc/src", "agent.ts"),

      // ── apps/shortlet-pricing ──────────────────────────────────────────
      abs("apps/shortlet-pricing/src", "agent.ts"),
    ],
  },
});
