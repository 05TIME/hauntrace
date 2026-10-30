import { steppedClock } from "./clock.js";
import { GENESIS_HASH, hashValue } from "./hash.js";
import { createRng } from "./rng.js";
import type { AgentDefinition, Ghost, RuleContext, RunOptions, Trace } from "./types.js";

export const FALLBACK_RULE_ID = "fallback";

export function rulesetHash<S, O, A>(agent: AgentDefinition<S, O, A>): string {
  return hashValue({
    name: agent.name,
    version: agent.version,
    rules: agent.rules.map((r) => ({ id: r.id, description: r.description })),
  });
}

function ghostHash(g: Omit<Ghost<unknown, unknown, unknown>, "hash">): string {
  return hashValue(g);
}

/** Run an agent over a sequence of observations, producing a hash-chained trace. */
export function run<S, O, A>(
  agent: AgentDefinition<S, O, A>,
  observations: ReadonlyArray<O>,
  options: RunOptions,
): Trace<S, O, A> {
  const ids = new Set<string>();
  for (const r of agent.rules) {
    if (ids.has(r.id) || r.id === FALLBACK_RULE_ID) throw new Error(`duplicate or reserved rule id: ${r.id}`);
    ids.add(r.id);
  }
  const rng = createRng(options.seed);
  const clock = steppedClock(options.startMs, options.stepMs);
  const ghosts: Ghost<S, O, A>[] = [];
  let state = structuredClone(agent.initialState);
  let prevHash = GENESIS_HASH;

  observations.forEach((rawObs, step) => {
    const obs = structuredClone(rawObs);
    const stateBefore = structuredClone(state);
    const ctx: RuleContext<S, O> = { state: stateBefore, obs, step, clock, rng };
    let ruleId = FALLBACK_RULE_ID;
    let result = null;
    for (const rule of agent.rules) {
      result = rule.evaluate(ctx);
      if (result) {
        ruleId = rule.id;
        break;
      }
    }
    result ??= agent.fallback(ctx);
    state = agent.reduce(structuredClone(stateBefore), obs, result.action);
    const body = {
      step,
      timeMs: clock.now(),
      obs,
      stateBefore,
      ruleId,
      reason: result.reason,
      action: result.action,
      stateAfter: structuredClone(state),
      prevHash,
    };
    const hash = ghostHash(body);
    ghosts.push({ ...body, hash });
    prevHash = hash;
    clock.tick();
  });

  return {
    agent: agent.name,
    agentVersion: agent.version,
    rulesetHash: rulesetHash(agent),
    options: { ...options },
    ghosts,
    headHash: prevHash,
  };
}

export interface VerifyResult {
  ok: boolean;
  /** First step whose hash does not match, if any. */
  brokenAt?: number;
  reason?: string;
}

/** Check a trace's hash chain without re-running the agent. */
export function verifyChain(trace: Trace<unknown, unknown, unknown>): VerifyResult {
  let prev = GENESIS_HASH;
  for (const g of trace.ghosts) {
    const { hash, ...body } = g;
    if (body.prevHash !== prev) return { ok: false, brokenAt: g.step, reason: "prevHash mismatch" };
    if (ghostHash(body) !== hash) return { ok: false, brokenAt: g.step, reason: "hash mismatch" };
    prev = hash;
  }
  if (prev !== trace.headHash) return { ok: false, reason: "headHash mismatch" };
  return { ok: true };
}

/** Re-run the agent from the trace's inputs and confirm it reproduces the same ghosts. */
export function replay<S, O, A>(agent: AgentDefinition<S, O, A>, trace: Trace<S, O, A>): VerifyResult {
  const chain = verifyChain(trace as Trace<unknown, unknown, unknown>);
  if (!chain.ok) return chain;
  if (rulesetHash(agent) !== trace.rulesetHash) return { ok: false, reason: "ruleset changed" };
  const again = run(agent, trace.ghosts.map((g) => g.obs), trace.options);
  for (let i = 0; i < trace.ghosts.length; i++) {
    if (again.ghosts[i]?.hash !== trace.ghosts[i]?.hash) {
      return { ok: false, brokenAt: i, reason: "replay diverged" };
    }
  }
  return { ok: true };
}

export interface GhostDiff<A> {
  step: number;
  before: { ruleId: string; action: A; reason: string };
  after: { ruleId: string; action: A; reason: string };
}

export interface WhatIfResult<S, O, A> {
  trace: Trace<S, O, A>;
  diffs: GhostDiff<A>[];
}

/**
 * Counterfactual: patch some observations, re-run with the same seed and clock,
 * and list every step whose decision changed. The original trace is untouched.
 */
export function whatIf<S, O, A>(
  agent: AgentDefinition<S, O, A>,
  trace: Trace<S, O, A>,
  patch: (obs: O, step: number) => O,
): WhatIfResult<S, O, A> {
  const patched = trace.ghosts.map((g) => patch(structuredClone(g.obs), g.step));
  const alt = run(agent, patched, trace.options);
  const diffs: GhostDiff<A>[] = [];
  alt.ghosts.forEach((g, i) => {
    const o = trace.ghosts[i];
    if (!o) return;
    if (o.ruleId !== g.ruleId || hashValue(o.action) !== hashValue(g.action)) {
      diffs.push({
        step: i,
        before: { ruleId: o.ruleId, action: o.action, reason: o.reason },
        after: { ruleId: g.ruleId, action: g.action, reason: g.reason },
      });
    }
  });
  return { trace: alt, diffs };
}
