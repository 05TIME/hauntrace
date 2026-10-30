import { describe, expect, it } from "vitest";
import {
  createAgentTool,
  ToolInputError,
  run,
  replay,
  type AgentDefinition,
  type RunOptions,
  type ToolCallInput,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Shared fake agent (same as engine / http tests — no real LLM, no network)
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

const opts: RunOptions = { seed: 7, startMs: 1000, stepMs: 10 };
const obs: O[] = [{ n: 12 }, { n: -3 }, { n: 4 }];

// ---------------------------------------------------------------------------
// Tool definition shape
// ---------------------------------------------------------------------------

describe("createAgentTool — definition", () => {
  it("returns an object with definition, handle and handleRaw", () => {
    const tool = createAgentTool(agent);
    expect(tool).toHaveProperty("definition");
    expect(typeof tool.handle).toBe("function");
    expect(typeof tool.handleRaw).toBe("function");
  });

  it("definition.name defaults to the agent name", () => {
    const tool = createAgentTool(agent);
    expect(tool.definition.name).toBe("counter");
  });

  it("definition.name is overridable", () => {
    const tool = createAgentTool(agent, "my_custom_tool");
    expect(tool.definition.name).toBe("my_custom_tool");
  });

  it("replaces non-identifier characters in the default name", () => {
    const weirdAgent: AgentDefinition<S, O, A> = { ...agent, name: "my-agent/v2" };
    const tool = createAgentTool(weirdAgent);
    // only alphanumeric and underscores
    expect(tool.definition.name).toMatch(/^[a-zA-Z0-9_]+$/);
  });

  it("definition.description mentions the agent name and version", () => {
    const tool = createAgentTool(agent);
    expect(tool.definition.description).toContain("counter");
    expect(tool.definition.description).toContain("v1");
  });

  it("inputSchema has type object with required observations and options", () => {
    const { inputSchema } = createAgentTool(agent).definition;
    expect(inputSchema.type).toBe("object");
    expect(inputSchema.required).toContain("observations");
    expect(inputSchema.required).toContain("options");
    expect(inputSchema.properties).toHaveProperty("observations");
    expect(inputSchema.properties).toHaveProperty("options");
  });

  it("inputSchema includes optional proposedAction and whatIfPatch", () => {
    const { inputSchema } = createAgentTool(agent).definition;
    expect(inputSchema.properties).toHaveProperty("proposedAction");
    expect(inputSchema.properties).toHaveProperty("whatIfPatch");
  });

  it("inputSchema options object lists seed, startMs and stepMs as properties", () => {
    const { inputSchema } = createAgentTool(agent).definition;
    const optionsProp = inputSchema.properties["options"] as { properties: Record<string, unknown> };
    expect(optionsProp.properties).toHaveProperty("seed");
    expect(optionsProp.properties).toHaveProperty("startMs");
    expect(optionsProp.properties).toHaveProperty("stepMs");
  });
});

// ---------------------------------------------------------------------------
// handle — happy path
// ---------------------------------------------------------------------------

describe("handle — happy path", () => {
  const tool = createAgentTool(agent);

  it("returns trace, replayVerification and divergences", () => {
    const result = tool.handle({ observations: obs, options: opts });
    expect(result).toHaveProperty("trace");
    expect(result).toHaveProperty("replayVerification");
    expect(result).toHaveProperty("divergences");
  });

  it("replayVerification.ok is true", () => {
    const result = tool.handle({ observations: obs, options: opts });
    expect(result.replayVerification.ok).toBe(true);
  });

  it("trace matches a direct run", () => {
    const result = tool.handle({ observations: obs, options: opts });
    const direct = run(agent, obs, opts);
    expect(result.trace.headHash).toBe(direct.headHash);
    expect(result.trace.ghosts).toHaveLength(direct.ghosts.length);
  });

  it("trace passes external replay", () => {
    const result = tool.handle({ observations: obs, options: opts });
    expect(replay(agent, result.trace).ok).toBe(true);
  });

  it("divergences is empty when proposedAction is not supplied", () => {
    const result = tool.handle({ observations: obs, options: opts });
    expect(result.divergences).toEqual([]);
  });

  it("whatIfResult is absent when whatIfPatch is not supplied", () => {
    const result = tool.handle({ observations: obs, options: opts });
    expect(result).not.toHaveProperty("whatIfResult");
  });

  it("ghosts have the expected ruleIds for the counter agent", () => {
    const result = tool.handle({ observations: obs, options: opts });
    expect(result.trace.ghosts.map((g) => g.ruleId)).toEqual(["big", "small", "fallback"]);
  });

  it("is deterministic: two calls with the same inputs produce the same headHash", () => {
    const a = tool.handle({ observations: obs, options: opts });
    const b = tool.handle({ observations: obs, options: opts });
    expect(a.trace.headHash).toBe(b.trace.headHash);
  });
});

// ---------------------------------------------------------------------------
// handle — proposedAction divergences
// ---------------------------------------------------------------------------

describe("handle — proposedAction divergence tracking", () => {
  const tool = createAgentTool(agent);

  it("no divergences when proposed matches every decision", () => {
    // obs[0] fires "big" with value 12
    const result = tool.handle({
      observations: [{ n: 12 }],
      options: opts,
      proposedAction: { kind: "big", value: 12 },
    });
    expect(result.divergences).toHaveLength(0);
  });

  it("reports divergence when proposal differs at step 0", () => {
    const result = tool.handle({
      observations: [{ n: 12 }],
      options: opts,
      proposedAction: { kind: "small", value: -99 },
    });
    expect(result.divergences).toHaveLength(1);
    expect(result.divergences[0]!.step).toBe(0);
    expect(result.divergences[0]!.proposed).toEqual({ kind: "small", value: -99 });
    expect(result.divergences[0]!.decided).toEqual({ kind: "big", value: 12 });
  });

  it("divergence carries the agent's reason", () => {
    const result = tool.handle({
      observations: [{ n: 12 }],
      options: opts,
      proposedAction: { kind: "small", value: 0 },
    });
    expect(result.divergences[0]!.reason).toBe("n=12 >= 10");
  });

  it("reports multiple divergences across steps", () => {
    // obs = [12, -3, 4]; propose the wrong action for two of three steps
    const result = tool.handle({
      observations: obs,
      options: opts,
      proposedAction: { kind: "coin", value: 0 }, // wrong for steps 0 and 1
    });
    // step 0 → big, step 1 → small: both diverge from the proposal
    expect(result.divergences.length).toBeGreaterThanOrEqual(2);
    const steps = result.divergences.map((d) => d.step);
    expect(steps).toContain(0);
    expect(steps).toContain(1);
  });

  it("all three steps diverge when proposal is never right", () => {
    const result = tool.handle({
      observations: obs,
      options: opts,
      proposedAction: { kind: "big", value: 999 },
    });
    expect(result.divergences).toHaveLength(3);
  });

  it("no divergences for a single-obs run when proposal matches exactly", () => {
    // obs [{ n: -5 }] → small rule fires → action { kind: "small", value: -5 }
    const result = tool.handle({
      observations: [{ n: -5 }],
      options: opts,
      proposedAction: { kind: "small", value: -5 },
    });
    expect(result.divergences).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// handle — whatIfPatch
// ---------------------------------------------------------------------------

describe("handle — whatIfPatch", () => {
  const tool = createAgentTool(agent);

  it("whatIfResult is present when whatIfPatch is provided", () => {
    const result = tool.handle({ observations: obs, options: opts, whatIfPatch: { n: 99 } });
    expect(result).toHaveProperty("whatIfResult");
  });

  it("identity patch yields zero diffs", () => {
    const result = tool.handle({ observations: obs, options: opts, whatIfPatch: {} });
    expect(result.whatIfResult!.diffs).toHaveLength(0);
  });

  it("non-identity patch surfaces diffs", () => {
    // Patch n=99 for every obs → all steps should fire "big"
    const result = tool.handle({ observations: obs, options: opts, whatIfPatch: { n: 99 } });
    // steps 1 (small) and 2 (coin) should now differ
    expect(result.whatIfResult!.diffs.length).toBeGreaterThan(0);
  });

  it("whatIfResult.trace is a valid replay-able trace", () => {
    const result = tool.handle({ observations: obs, options: opts, whatIfPatch: { n: 99 } });
    expect(replay(agent, result.whatIfResult!.trace).ok).toBe(true);
  });

  it("whatIfResult and divergences can both be present simultaneously", () => {
    const result = tool.handle({
      observations: obs,
      options: opts,
      proposedAction: { kind: "big", value: 999 },
      whatIfPatch: { n: 99 },
    });
    expect(result.whatIfResult).toBeDefined();
    expect(result.divergences.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// handle — input validation errors
// ---------------------------------------------------------------------------

describe("handle — validation errors", () => {
  const tool = createAgentTool(agent);

  it("throws ToolInputError when observations is empty", () => {
    expect(() =>
      tool.handle({ observations: [], options: opts }),
    ).toThrow(ToolInputError);
  });

  it("error details mention observations", () => {
    try {
      tool.handle({ observations: [], options: opts });
    } catch (e) {
      const err = e as ToolInputError;
      expect(err.details.some((d) => d.includes("observations"))).toBe(true);
    }
  });

  it("throws ToolInputError when options.seed is not a number", () => {
    expect(() =>
      tool.handle({
        observations: obs,
        options: { seed: NaN, startMs: 0, stepMs: 1000 },
      }),
    ).toThrow(ToolInputError);
  });

  it("throws ToolInputError when options.startMs is Infinity", () => {
    expect(() =>
      tool.handle({
        observations: obs,
        options: { seed: 1, startMs: Infinity, stepMs: 1000 },
      }),
    ).toThrow(ToolInputError);
  });

  it("ToolInputError.name is 'ToolInputError'", () => {
    try {
      tool.handle({ observations: [], options: opts });
    } catch (e) {
      expect((e as ToolInputError).name).toBe("ToolInputError");
    }
  });

  it("ToolInputError extends Error", () => {
    try {
      tool.handle({ observations: [], options: opts });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(ToolInputError);
    }
  });
});

// ---------------------------------------------------------------------------
// handleRaw — JSON parsing
// ---------------------------------------------------------------------------

describe("handleRaw — JSON string input", () => {
  const tool = createAgentTool(agent);

  const validPayload = (): ToolCallInput<O, A> => ({
    observations: obs,
    options: opts,
  });

  it("parses a valid JSON string and returns a result", () => {
    const result = tool.handleRaw(JSON.stringify(validPayload()));
    expect(result.replayVerification.ok).toBe(true);
    expect(result.trace.ghosts).toHaveLength(3);
  });

  it("result from handleRaw matches result from handle", () => {
    const fromRaw = tool.handleRaw(JSON.stringify(validPayload()));
    const fromHandle = tool.handle(validPayload());
    expect(fromRaw.trace.headHash).toBe(fromHandle.trace.headHash);
  });

  it("throws ToolInputError on non-JSON string", () => {
    expect(() => tool.handleRaw("not json")).toThrow(ToolInputError);
  });

  it("error message mentions JSON for a parse failure", () => {
    try {
      tool.handleRaw("{bad}");
    } catch (e) {
      expect((e as ToolInputError).message.toLowerCase()).toMatch(/json/);
    }
  });

  it("throws ToolInputError on a JSON array (not an object)", () => {
    expect(() => tool.handleRaw("[]")).toThrow(ToolInputError);
  });

  it("throws ToolInputError when observations is missing from JSON", () => {
    expect(() => tool.handleRaw(JSON.stringify({ options: opts }))).toThrow(ToolInputError);
  });

  it("throws ToolInputError when options is missing from JSON", () => {
    expect(() => tool.handleRaw(JSON.stringify({ observations: obs }))).toThrow(ToolInputError);
  });

  it("handles whatIfPatch in JSON string", () => {
    const payload = { ...validPayload(), whatIfPatch: { n: 99 } };
    const result = tool.handleRaw(JSON.stringify(payload));
    expect(result.whatIfResult).toBeDefined();
  });

  it("handles proposedAction in JSON string and surfaces divergences", () => {
    const payload = { ...validPayload(), proposedAction: { kind: "big", value: 999 } };
    const result = tool.handleRaw(JSON.stringify(payload));
    expect(result.divergences.length).toBeGreaterThan(0);
  });

  it("throws ToolInputError when whatIfPatch is not an object in JSON", () => {
    const payload = { ...validPayload(), whatIfPatch: "bad" };
    expect(() => tool.handleRaw(JSON.stringify(payload))).toThrow(ToolInputError);
  });
});

// ---------------------------------------------------------------------------
// Multiple independent agent instances
// ---------------------------------------------------------------------------

describe("multiple agent instances", () => {
  it("tools for different agents are independent", () => {
    type S2 = { seen: number };
    type O2 = { flag: boolean };
    type A2 = "yes" | "no";

    const agentB: AgentDefinition<S2, O2, A2> = {
      name: "flag-checker",
      version: "1",
      initialState: { seen: 0 },
      rules: [
        {
          id: "flag-on",
          description: "flag is true",
          evaluate: ({ obs }) => (obs.flag ? { action: "yes", reason: "flag set" } : null),
        },
      ],
      fallback: () => ({ action: "no", reason: "flag not set" }),
      reduce: (s) => ({ seen: s.seen + 1 }),
    };

    const toolA = createAgentTool(agent);
    const toolB = createAgentTool(agentB);

    const resultA = toolA.handle({ observations: obs, options: opts });
    const resultB = toolB.handle({
      observations: [{ flag: true }, { flag: false }],
      options: opts,
    });

    expect(resultA.replayVerification.ok).toBe(true);
    expect(resultB.replayVerification.ok).toBe(true);
    expect(resultA.trace.agent).toBe("counter");
    expect(resultB.trace.agent).toBe("flag-checker");
    expect(resultB.trace.ghosts[0]!.ruleId).toBe("flag-on");
    expect(resultB.trace.ghosts[1]!.ruleId).toBe("fallback");
  });

  it("createAgentTool does not mutate the agent", () => {
    const nameBefore = agent.name;
    const rulesBefore = agent.rules.length;
    createAgentTool(agent);
    expect(agent.name).toBe(nameBefore);
    expect(agent.rules).toHaveLength(rulesBefore);
  });
});

// ---------------------------------------------------------------------------
// ToolInputError standalone
// ---------------------------------------------------------------------------

describe("ToolInputError", () => {
  it("carries details array", () => {
    const err = new ToolInputError("oops", ["detail 1", "detail 2"]);
    expect(err.details).toEqual(["detail 1", "detail 2"]);
  });

  it("defaults details to empty array", () => {
    const err = new ToolInputError("oops");
    expect(err.details).toEqual([]);
  });

  it("has the correct name and message", () => {
    const err = new ToolInputError("bad input", ["x"]);
    expect(err.name).toBe("ToolInputError");
    expect(err.message).toBe("bad input");
  });

  it("is an instanceof Error", () => {
    expect(new ToolInputError("x")).toBeInstanceOf(Error);
  });
});
