import { run, replay, whatIf } from "./engine.js";
import type { AgentDefinition, RunOptions, Trace } from "./types.js";
import type { VerifyResult, WhatIfResult } from "./engine.js";

// ---------------------------------------------------------------------------
// JSON Schema subset (enough to describe tool inputs to any LLM provider)
// ---------------------------------------------------------------------------

/** A minimal, provider-agnostic JSON Schema object for tool input descriptions. */
export interface JsonSchemaObject {
  type: "object";
  description?: string;
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export type JsonSchemaProperty =
  | { type: "string"; description?: string; enum?: string[] }
  | { type: "number"; description?: string }
  | { type: "integer"; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "array"; description?: string; items?: JsonSchemaProperty }
  | { type: "object"; description?: string; properties?: Record<string, JsonSchemaProperty>; additionalProperties?: boolean };

// ---------------------------------------------------------------------------
// Tool definition (provider-agnostic)
// ---------------------------------------------------------------------------

/**
 * Provider-agnostic tool definition.
 *
 * This shape is compatible with OpenAI function-calling, Anthropic tool use,
 * and any other provider that uses a name + description + JSON Schema input
 * pattern. You can map it to the specific wire format your provider expects:
 *
 * ```ts
 * // OpenAI
 * { type: "function", function: { name, description, parameters: inputSchema } }
 *
 * // Anthropic
 * { name, description, input_schema: inputSchema }
 * ```
 */
export interface ToolDefinition {
  /** Unique tool name (safe for use as a function name). */
  name: string;
  /** Human-readable description sent to the LLM so it knows when to call this tool. */
  description: string;
  /** JSON Schema describing the arguments the LLM must provide when calling this tool. */
  inputSchema: JsonSchemaObject;
}

// ---------------------------------------------------------------------------
// Tool call inputs and outputs
// ---------------------------------------------------------------------------

/**
 * The arguments an LLM passes when calling the agent tool.
 *
 * - `observations`: the sequence of observations to run the agent over.
 * - `options`: seed, startMs and stepMs for deterministic replay.
 * - `proposedAction`: the action the LLM believes should be taken at each step
 *   (optional). When provided, each step whose agent decision differs from the
 *   proposal is recorded in the response as a `divergence`.
 * - `whatIfPatch`: optional shallow-merge patch applied to every observation
 *   for a counterfactual what-if run (same semantics as the HTTP adapter).
 */
export interface ToolCallInput<O, A> {
  observations: O[];
  options: RunOptions;
  proposedAction?: A;
  whatIfPatch?: Partial<O>;
}

/**
 * A single step where the agent's decision differs from the LLM's proposal.
 */
export interface ActionDivergence<A> {
  step: number;
  proposed: A;
  decided: A;
  reason: string;
}

/**
 * The result returned to the LLM after calling the agent tool.
 *
 * - `trace`: the full hash-chained ghost trace.
 * - `replayVerification`: result of replaying the trace (always present so the
 *   LLM can confirm the chain is intact).
 * - `divergences`: steps where the agent disagreed with the LLM's proposed
 *   action. Empty array when `proposedAction` was not supplied.
 * - `whatIfResult`: present only when `whatIfPatch` was supplied.
 */
export interface ToolCallResult<S, O, A> {
  trace: Trace<S, O, A>;
  replayVerification: VerifyResult;
  divergences: ActionDivergence<A>[];
  whatIfResult?: WhatIfResult<S, O, A>;
}

// ---------------------------------------------------------------------------
// LLM tool handle
// ---------------------------------------------------------------------------

/**
 * A bound agent tool, ready to be called by an LLM.
 *
 * Obtain one via {@link createAgentTool}.
 */
export interface AgentTool<S, O, A> {
  /** Tool definition to register with the LLM provider. */
  definition: ToolDefinition;
  /**
   * Handle a tool call from the LLM.
   *
   * @param input - Already-parsed tool call arguments (the LLM's JSON payload).
   *   Pass the raw JSON string to `handleRaw` if you have not yet parsed it.
   * @throws {ToolInputError} if the input is structurally invalid.
   */
  handle(input: ToolCallInput<O, A>): ToolCallResult<S, O, A>;
  /**
   * Parse a raw JSON string from the LLM, validate it, then delegate to
   * `handle`. Convenience wrapper for providers that deliver tool call
   * arguments as a JSON string.
   *
   * @throws {ToolInputError} if the string is not valid JSON or fails validation.
   */
  handleRaw(json: string): ToolCallResult<S, O, A>;
}

// ---------------------------------------------------------------------------
// Validation error
// ---------------------------------------------------------------------------

/** Thrown when the LLM supplies an invalid tool call payload. */
export class ToolInputError extends Error {
  readonly details: string[];
  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "ToolInputError";
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateOptions(raw: unknown, details: string[]): raw is RunOptions {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    details.push('"options" must be a plain object');
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

function validateInput<O, A>(raw: unknown): ToolCallInput<O, A> {
  const details: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolInputError("tool call input must be a JSON object", [
      'expected an object with "observations" and "options"',
    ]);
  }

  const obj = raw as Record<string, unknown>;

  // observations
  if (!Array.isArray(obj["observations"])) {
    details.push('"observations" must be an array');
  } else if ((obj["observations"] as unknown[]).length === 0) {
    details.push('"observations" must contain at least one item');
  }

  // options
  validateOptions(obj["options"], details);

  // whatIfPatch (optional)
  if ("whatIfPatch" in obj && obj["whatIfPatch"] !== undefined) {
    if (
      typeof obj["whatIfPatch"] !== "object" ||
      obj["whatIfPatch"] === null ||
      Array.isArray(obj["whatIfPatch"])
    ) {
      details.push('"whatIfPatch" must be a plain object if provided');
    }
  }

  if (details.length > 0) {
    throw new ToolInputError("invalid tool call input", details);
  }

  const result: ToolCallInput<O, A> = {
    observations: obj["observations"] as O[],
    options: obj["options"] as RunOptions,
  };

  if ("proposedAction" in obj && obj["proposedAction"] !== undefined) {
    result.proposedAction = obj["proposedAction"] as A;
  }

  if ("whatIfPatch" in obj && obj["whatIfPatch"] !== undefined) {
    result.whatIfPatch = obj["whatIfPatch"] as Partial<O>;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Wrap an agent as a provider-agnostic LLM tool.
 *
 * The returned {@link AgentTool} exposes:
 *
 * 1. **`definition`** – the tool name, description and JSON Schema to register
 *    with the LLM provider (map to `function.parameters` for OpenAI, or
 *    `input_schema` for Anthropic, etc.).
 *
 * 2. **`handle(input)`** – validates the LLM's tool call arguments, runs the
 *    engine, verifies the hash chain via replay, and returns the full trace plus
 *    any divergences between the LLM's proposed action and the agent's decision.
 *
 * 3. **`handleRaw(json)`** – same as `handle` but accepts the raw JSON string
 *    that some providers deliver as the tool call arguments.
 *
 * No API keys, network calls or external dependencies are required. The adapter
 * is entirely self-contained and deterministic given the same inputs.
 *
 * @example
 * ```ts
 * const tool = createAgentTool(myAgent);
 *
 * // Register with OpenAI
 * const openAiTool = {
 *   type: "function",
 *   function: {
 *     name: tool.definition.name,
 *     description: tool.definition.description,
 *     parameters: tool.definition.inputSchema,
 *   },
 * };
 *
 * // Handle a tool call
 * const result = tool.handle({
 *   observations: [...],
 *   options: { seed: 1, startMs: 0, stepMs: 1000 },
 *   proposedAction: "approve",
 * });
 * console.log(result.divergences); // steps where agent disagreed with LLM
 * console.log(result.replayVerification.ok); // true if chain is intact
 * ```
 *
 * @param agent The agent to expose as a tool.
 * @param toolName Optional override for the tool name (defaults to the agent name
 *   with non-identifier characters replaced by underscores).
 */
export function createAgentTool<S, O, A>(
  agent: AgentDefinition<S, O, A>,
  toolName?: string,
): AgentTool<S, O, A> {
  const name = toolName ?? agent.name.replace(/[^a-zA-Z0-9_]/g, "_");

  const definition: ToolDefinition = {
    name,
    description:
      `Run agent "${agent.name}" (v${agent.version}) over a sequence of observations. ` +
      `Returns a hash-chained trace, replay verification, and — when you provide ` +
      `"proposedAction" — a list of steps where the agent's decision differed from ` +
      `your proposal, with the agent's explanation for each divergence. ` +
      `Optionally supply "whatIfPatch" to get a counterfactual run.`,
    inputSchema: {
      type: "object",
      description: `Arguments for the ${name} agent tool.`,
      properties: {
        observations: {
          type: "array",
          description:
            "Non-empty sequence of observation values to run the agent over. " +
            "Each element must match the agent's expected observation shape.",
          items: { type: "object", description: "A single observation.", additionalProperties: true },
        },
        options: {
          type: "object",
          description:
            'Run options controlling determinism. "seed" is the PRNG seed; ' +
            '"startMs" is the clock start in milliseconds; "stepMs" is the clock ' +
            "increment between observations.",
          properties: {
            seed: { type: "number", description: "Integer PRNG seed." },
            startMs: { type: "number", description: "Clock start in milliseconds." },
            stepMs: { type: "number", description: "Clock increment per step in milliseconds." },
          },
          additionalProperties: false,
        },
        proposedAction: {
          type: "object",
          description:
            "Optional: the action you believe should be taken at every step. " +
            "When provided, each step where the agent decides differently is " +
            "reported as a divergence with the agent's explanation.",
          additionalProperties: true,
        },
        whatIfPatch: {
          type: "object",
          description:
            "Optional: a shallow-merge patch applied to every observation for a " +
            "counterfactual what-if run. Steps whose decision changes are listed in " +
            '"whatIfResult.diffs".',
          additionalProperties: true,
        },
      },
      required: ["observations", "options"],
      additionalProperties: false,
    },
  };

  function handle(input: ToolCallInput<O, A>): ToolCallResult<S, O, A> {
    // Re-validate: the caller may have skipped handleRaw and built ToolCallInput
    // manually; we still want to catch obviously bad shapes early.
    const details: string[] = [];
    if (!Array.isArray(input.observations) || input.observations.length === 0) {
      details.push('"observations" must be a non-empty array');
    }
    validateOptions(input.options, details);
    if (details.length > 0) {
      throw new ToolInputError("invalid tool call input", details);
    }

    // Run engine
    let trace: Trace<S, O, A>;
    try {
      trace = run(agent, input.observations, input.options);
    } catch (e) {
      throw new ToolInputError(`agent run failed: ${(e as Error).message}`);
    }

    // Replay verification (always)
    const replayVerification = replay(agent, trace);

    // Divergences: compare proposed action against each ghost
    const divergences: ActionDivergence<A>[] = [];
    if (input.proposedAction !== undefined) {
      const proposed = input.proposedAction;
      for (const ghost of trace.ghosts) {
        // Use JSON comparison so that object-valued actions compare by value
        if (JSON.stringify(ghost.action) !== JSON.stringify(proposed)) {
          divergences.push({
            step: ghost.step,
            proposed,
            decided: ghost.action,
            reason: ghost.reason,
          });
        }
      }
    }

    // Optional what-if
    let whatIfResult: WhatIfResult<S, O, A> | undefined;
    if (input.whatIfPatch !== undefined) {
      const patch = input.whatIfPatch;
      whatIfResult = whatIf(agent, trace, (obs) => ({ ...obs, ...patch }));
    }

    const result: ToolCallResult<S, O, A> = {
      trace,
      replayVerification,
      divergences,
    };
    if (whatIfResult !== undefined) {
      result.whatIfResult = whatIfResult;
    }
    return result;
  }

  function handleRaw(json: string): ToolCallResult<S, O, A> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      throw new ToolInputError(`tool call arguments must be valid JSON: ${(e as Error).message}`);
    }
    const input = validateInput<O, A>(parsed);
    return handle(input);
  }

  return { definition, handle, handleRaw };
}
