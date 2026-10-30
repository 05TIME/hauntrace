import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createAgentServer } from "../../../packages/core/src/index.js";
import { hauntedNpcAgent } from "./agent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_TRACE_PATH = join(__dirname, "example-trace-npc.json");

/**
 * Create an HTTP server wired to the haunted-npc agent.
 * - POST /run   — run the agent (see createAgentServer)
 * - GET /example — serve the static EXAMPLE trace JSON
 *
 * EXAMPLE: This server uses synthetic demo data only.
 */
export function createNpcServer() {
  // Base agent server handles POST /run
  const baseServer = createAgentServer(hauntedNpcAgent);

  // Wrap the base request handler to intercept GET /example
  const baseListeners = baseServer.listeners("request") as Parameters<typeof baseServer.on>[1][];
  baseServer.removeAllListeners("request");

  baseServer.on("request", (req, res) => {
    if (req.method === "GET" && req.url === "/example") {
      res.writeHead(200, { "Content-Type": "application/json" });
      const stream = createReadStream(EXAMPLE_TRACE_PATH);
      stream.on("error", () => {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
        }
        res.end(JSON.stringify({ error: "example trace not found" }));
      });
      stream.pipe(res);
      return;
    }
    // Delegate everything else to the base handler
    for (const listener of baseListeners) {
      listener(req, res);
    }
  });

  return baseServer;
}
