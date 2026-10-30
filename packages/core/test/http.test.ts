import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAgentServer, run, replay, type AgentDefinition, type RunOptions } from "../src/index.js";

// ---------------------------------------------------------------------------
// Shared minimal agent
// ---------------------------------------------------------------------------

type S = { total: number };
type O = { n: number };
type A = { kind: "big" | "small" | "coin"; value: number };

const agent: AgentDefinition<S, O, A> = {
  name: "counter",
  version: "1",
  initialState: { total: 0 },
  rules: [
    {
      id: "big",
      description: "n >= 10",
      evaluate: ({ obs }) =>
        obs.n >= 10 ? { action: { kind: "big", value: obs.n }, reason: `n=${obs.n} >= 10` } : null,
    },
    {
      id: "small",
      description: "n < 0",
      evaluate: ({ obs }) =>
        obs.n < 0 ? { action: { kind: "small", value: obs.n }, reason: "negative" } : null,
    },
  ],
  fallback: ({ rng }) => ({ action: { kind: "coin", value: rng.int(0, 100) }, reason: "coin flip" }),
  reduce: (s, _o, a) => ({ total: s.total + a.value }),
};

const validOptions: RunOptions = { seed: 7, startMs: 1000, stepMs: 10 };
const validObs: O[] = [{ n: 12 }, { n: -3 }, { n: 4 }];

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let baseUrl: string;
let server: ReturnType<typeof createAgentServer>;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = createAgentServer(agent);
      // Bind to loopback on an ephemeral port — no external network.
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
);

async function post(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function get(path: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`);
  const json = await res.json();
  return { status: res.status, json };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("POST /run — happy path", () => {
  it("returns 200 with trace and replayResult.ok=true", async () => {
    const { status, json } = await post("/run", { observations: validObs, options: validOptions });
    expect(status).toBe(200);
    const body = json as { trace: unknown; replayResult: { ok: boolean } };
    expect(body.replayResult.ok).toBe(true);
    expect(body).toHaveProperty("trace");
  });

  it("trace has the expected ghosts", async () => {
    const { json } = await post("/run", { observations: validObs, options: validOptions });
    const body = json as { trace: ReturnType<typeof run<S, O, A>> };
    expect(body.trace.ghosts).toHaveLength(3);
    expect(body.trace.ghosts[0]!.ruleId).toBe("big");
    expect(body.trace.ghosts[1]!.ruleId).toBe("small");
  });

  it("trace headHash matches a direct run", async () => {
    const { json } = await post("/run", { observations: validObs, options: validOptions });
    const body = json as { trace: ReturnType<typeof run<S, O, A>> };
    const direct = run(agent, validObs, validOptions);
    expect(body.trace.headHash).toBe(direct.headHash);
  });

  it("trace passes verifyChain and replay directly", async () => {
    const { json } = await post("/run", { observations: validObs, options: validOptions });
    const body = json as { trace: ReturnType<typeof run<S, O, A>> };
    expect(replay(agent, body.trace).ok).toBe(true);
  });

  it("returns whatIfResult when whatIfPatch is provided", async () => {
    const { status, json } = await post("/run", {
      observations: validObs,
      options: validOptions,
      whatIfPatch: { n: 99 },
    });
    expect(status).toBe(200);
    const body = json as { whatIfResult: { diffs: unknown[] } };
    expect(body).toHaveProperty("whatIfResult");
    // patching n=99 means every obs fires "big", so steps that were "small" or "coin" differ
    expect(body.whatIfResult.diffs.length).toBeGreaterThan(0);
  });

  it("omits whatIfResult when no whatIfPatch is provided", async () => {
    const { json } = await post("/run", { observations: validObs, options: validOptions });
    expect(json).not.toHaveProperty("whatIfResult");
  });

  it("identity whatIfPatch produces zero diffs", async () => {
    const { json } = await post("/run", {
      observations: validObs,
      options: validOptions,
      whatIfPatch: {},
    });
    const body = json as { whatIfResult: { diffs: unknown[] } };
    expect(body.whatIfResult.diffs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Validation — 400 errors
// ---------------------------------------------------------------------------

describe("POST /run — validation errors (400)", () => {
  it("returns 400 when body is not JSON", async () => {
    const res = await fetch(`${baseUrl}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });
    const json = await res.json();
    expect(res.status).toBe(400);
    expect((json as { error: string }).error).toMatch(/valid JSON/i);
  });

  it("returns 400 when body is a JSON array", async () => {
    const { status, json } = await post("/run", []);
    expect(status).toBe(400);
    expect((json as { error: string }).error).toBeTruthy();
  });

  it("returns 400 when observations is missing", async () => {
    const { status, json } = await post("/run", { options: validOptions });
    expect(status).toBe(400);
    const body = json as { error: string; details?: string[] };
    expect(body.details?.some((d) => d.includes("observations"))).toBe(true);
  });

  it("returns 400 when observations is empty", async () => {
    const { status, json } = await post("/run", { observations: [], options: validOptions });
    expect(status).toBe(400);
    const body = json as { details: string[] };
    expect(body.details.some((d) => d.includes("observations"))).toBe(true);
  });

  it("returns 400 when options is missing", async () => {
    const { status, json } = await post("/run", { observations: validObs });
    expect(status).toBe(400);
    const body = json as { error: string; details?: string[] };
    expect(body.details?.some((d) => d.includes("options"))).toBe(true);
  });

  it("returns 400 when options.seed is missing", async () => {
    const { status, json } = await post("/run", {
      observations: validObs,
      options: { startMs: 0, stepMs: 1000 },
    });
    expect(status).toBe(400);
    const body = json as { details: string[] };
    expect(body.details.some((d) => d.includes("seed"))).toBe(true);
  });

  it("returns 400 when options.startMs is NaN (sent as null)", async () => {
    const { status, json } = await post("/run", {
      observations: validObs,
      options: { seed: 1, startMs: null, stepMs: 1000 },
    });
    expect(status).toBe(400);
    const body = json as { details: string[] };
    expect(body.details.some((d) => d.includes("startMs"))).toBe(true);
  });

  it("returns 400 when observations is not an array", async () => {
    const { status, json } = await post("/run", { observations: "oops", options: validOptions });
    expect(status).toBe(400);
    const body = json as { details: string[] };
    expect(body.details.some((d) => d.includes("observations"))).toBe(true);
  });

  it("returns 400 when whatIfPatch is not an object", async () => {
    const { status, json } = await post("/run", {
      observations: validObs,
      options: validOptions,
      whatIfPatch: "bad",
    });
    expect(status).toBe(400);
    const body = json as { details: string[] };
    expect(body.details.some((d) => d.includes("whatIfPatch"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

describe("routing", () => {
  it("returns 404 for unknown paths", async () => {
    const res = await fetch(`${baseUrl}/ghost`);
    expect(res.status).toBe(404);
  });

  it("returns 405 for GET /run", async () => {
    const { status } = await get("/run");
    expect(status).toBe(405);
  });
});
