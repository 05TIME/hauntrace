import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      // Shim out node:crypto so agent files bundle safely in the browser.
      // The viewer's agentRunner never calls sha256/hashValue at runtime.
      "node:crypto": path.resolve(__dirname, "src/crypto-shim.ts"),
    },
  },
});
