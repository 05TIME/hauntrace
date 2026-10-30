import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { run, replay, whatIf } from "./engine.js";
import type { AgentDefinition, RunOptions } from "./types.js";

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

/**
 * Request body for POST /run.
 * `observations` must be a non-empty array of agent observation values.
 * `options` must carry seed, startMs and stepMs as finite numbers.
 * `whatIfPatch` is optional: if provided it must be "none" (identity) or a
 * mapping object applied field-by-field to each observation (shallow merge).
 */
export interface RunRequest<O> {
  observations: O[];
  options: RunOptions;
  /** Optional shallow-merge patch applied to every observation for a what-if run. */
  whatIfPatch?: Partial<O>;
}

/** Successful response from POST /run. */
export interface RunResponse<S, O, A> {
  trace: import("./types.js").Trace<S, O, A>;
  replayResult: import("./engine.js").VerifyResult;
  /** Present only when the request included a whatIfPatch. */
  whatIfResult?: import("./engine.js").WhatIfResult<S, O, A>;
}

/** Error response from POST /run. */
export interface ErrorResponse {
  error: string;
  details?: string[];
}

// ---------------------------------------------------------------------------
// Server options
// ---------------------------------------------------------------------------

export interface AgentServerOptions {
  /** Maximum request body size in bytes (default: 1 MiB). */
  maxBodyBytes?: number;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateRunOptions(raw: unknown, details: string[]): raw is RunOptions {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    details.push('"options" must be an object');
    return false;
  }
  const o = raw as Record<string, unknown>;
  let ok = true;
  for (const key of ["seed", "startMs", "stepMs"] as const) {
    if (typeof o[key] !== "number" || !Number.isFinite(o[key] as number)) {
      details.push(`"options.${key}" must be a finite number`);
      ok = false;
    }
  }
  return ok;
}

function validateBody(raw: unknown): { ok: true; body: RunRequest<unknown> } | { ok: false; details: string[] } {
  const details: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, details: ['request body must be a JSON object with "observations" and "options"'] };
  }

  const obj = raw as Record<string, unknown>;

  // observations
  if (!Array.isArray(obj["observations"])) {
    details.push('"observations" must be an array');
  } else if ((obj["observations"] as unknown[]).length === 0) {
    details.push('"observations" must contain at least one item');
  }

  // options
  const optionsOk = validateRunOptions(obj["options"], details);

  // whatIfPatch (optional)
  if ("whatIfPatch" in obj) {
    if (typeof obj["whatIfPatch"] !== "object" || obj["whatIfPatch"] === null || Array.isArray(obj["whatIfPatch"])) {
      details.push('"whatIfPatch" must be a plain object if provided');
    }
  }

  if (details.length > 0) return { ok: false, details };

  const base = {
    observations: obj["observations"] as unknown[],
    options: obj["options"] as RunOptions,
  };

  if (optionsOk && "whatIfPatch" in obj) {
    return {
      ok: true,
      body: { ...base, whatIfPatch: obj["whatIfPatch"] as Record<string, unknown> },
    };
  }

  return { ok: true, body: base };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error(`request body exceeds ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(json) });
  res.end(json);
}

function send400(res: ServerResponse, error: string, details?: string[]): void {
  const body: ErrorResponse = details?.length ? { error, details } : { error };
  sendJson(res, 400, body);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an HTTP server that exposes a single `POST /run` endpoint for an agent.
 *
 * **Endpoint: POST /run**
 *
 * Request body (JSON):
 * ```json
 * {
 *   "observations": [...],
 *   "options": { "seed": 1, "startMs": 0, "stepMs": 1000 },
 *   "whatIfPatch": { "areaOccupancyPct": 100 }  // optional shallow merge
 * }
 * ```
 *
 * Success response `200`:
 * ```json
 * { "trace": {...}, "replayResult": { "ok": true }, "whatIfResult": {...} }
 * ```
 *
 * Error response `400`:
 * ```json
 * { "error": "...", "details": ["..."] }
 * ```
 *
 * All other paths/methods return `404` or `405`.
 *
 * The server uses only `node:http` — no external dependencies.
 *
 * @param agent The agent definition to serve.
 * @param serverOptions Optional configuration (e.g. max body size).
 */
export function createAgentServer<S, O, A>(
  agent: AgentDefinition<S, O, A>,
  serverOptions?: AgentServerOptions,
): Server {
  const maxBodyBytes = serverOptions?.maxBodyBytes ?? 1_048_576; // 1 MiB

  const server = createServer(async (req, res) => {
    const { method, url } = req;

    // Only POST /run is defined.
    if (url !== "/run") {
      sendJson(res, 404, { error: "not found", details: [`path ${url ?? "unknown"} does not exist; use POST /run`] });
      return;
    }
    if (method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "method not allowed", details: [`use POST; got ${method ?? "unknown"}`] });
      return;
    }

    // Read body
    let rawBody: string;
    try {
      rawBody = await readBody(req, maxBodyBytes);
    } catch (e) {
      send400(res, (e as Error).message);
      return;
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      send400(res, "request body must be valid JSON");
      return;
    }

    // Validate
    const validation = validateBody(parsed);
    if (!validation.ok) {
      send400(res, "invalid request body", validation.details);
      return;
    }

    const { observations, options, whatIfPatch } = validation.body;

    // Run the agent
    let trace: import("./types.js").Trace<S, O, A>;
    try {
      trace = run(agent, observations as O[], options);
    } catch (e) {
      send400(res, `agent run failed: ${(e as Error).message}`);
      return;
    }

    // Always include a replay verification so the caller can confirm the chain.
    const replayResult = replay(agent, trace);

    // Optional what-if: shallow-merge the patch onto every observation.
    let whatIfResult: import("./engine.js").WhatIfResult<S, O, A> | undefined;
    if (whatIfPatch !== undefined) {
      const patch = whatIfPatch as Partial<O>;
      whatIfResult = whatIf(agent, trace, (obs) => ({ ...obs, ...patch }));
    }

    const response: RunResponse<S, O, A> = whatIfResult
      ? { trace, replayResult, whatIfResult }
      : { trace, replayResult };

    sendJson(res, 200, response);
  });

  return server;
}
