import { createAgentServer } from "../../../packages/core/src/http.js";
import { shortletPricingAgent } from "./agent.js";

/**
 * Create an HTTP server wired to the shortlet pricing agent.
 * Exposes POST /run — see createAgentServer for the full API contract.
 *
 * EXAMPLE: This server uses synthetic demo data only; it is not production pricing.
 *
 * @example
 * ```ts
 * import { createShortletServer } from "./server.js";
 * const server = createShortletServer();
 * server.listen(3000, "127.0.0.1", () => console.log("listening on :3000"));
 * ```
 */
export function createShortletServer() {
  return createAgentServer(shortletPricingAgent);
}
