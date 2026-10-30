/**
 * agentRunner.ts — browser-safe rule re-evaluation for known agents.
 *
 * Mirrors the decision logic of packages/core/src/engine.ts run() but WITHOUT
 * any hashing (no sha256, no node:crypto). We only need ruleId/action/reason
 * per step to compute what-if diffs — chain integrity is irrelevant here.
 *
 * node:crypto is aliased to a no-op shim in vite.config.ts / vitest.config.ts,
 * so agent imports that re-export from core compile safely in the browser.
 */

import { createRng } from "../../packages/core/src/rng.js";
import { steppedClock } from "../../packages/core/src/clock.js";
import type { AgentDefinition, RunOptions } from "../../packages/core/src/types.js";
import { hauntedNpcAgent } from "../../apps/haunted-npc/src/agent.js";
import { shortletPricingAgent } from "../../apps/shortlet-pricing/src/agent.js";
import type { Trace, Ghost } from "./types.js";

// ── Minimal step result ───────────────────────────────────────────────────────

export interface StepDecision {
  ruleId: string;
  action: unknown;
  reason: string;
}

// ── Core re-evaluation loop (no hashing) ─────────────────────────────────────

/**
 * Re-run an agent's rules over a sequence of observations using the same seed
 * and clock settings, but without computing any hashes.
 * Returns one StepDecision per observation.
 */
export function runRules<S, O, A>(
  agent: AgentDefinition<S, O, A>,
  observations: ReadonlyArray<O>,
  options: RunOptions,
): StepDecision[] {
  const FALLBACK_RULE_ID = "fallback";
  const rng = createRng(options.seed);
  const clock = steppedClock(options.startMs, options.stepMs);
  const decisions: StepDecision[] = [];
  let state = structuredClone(agent.initialState);

  observations.forEach((rawObs, step) => {
    const obs = structuredClone(rawObs);
    const stateBefore = structuredClone(state);
    const ctx = { state: stateBefore, obs, step, clock, rng } as Parameters<
      (typeof agent.rules)[number]["evaluate"]
    >[0];

    let ruleId = FALLBACK_RULE_ID;
    let result: { action: A; reason: string } | null = null;

    for (const rule of agent.rules) {
      const r = rule.evaluate(ctx);
      if (r) {
        ruleId = rule.id;
        result = r;
        break;
      }
    }

    result ??= agent.fallback(ctx);
    state = agent.reduce(structuredClone(stateBefore), obs, result.action);

    decisions.push({ ruleId, action: result.action, reason: result.reason });
    clock.tick();
  });

  return decisions;
}

// ── Registry of known agents ──────────────────────────────────────────────────

type AnyAgent = AgentDefinition<unknown, unknown, unknown>;

const AGENT_REGISTRY: Record<string, AnyAgent> = {
  "haunted-npc": hauntedNpcAgent as AnyAgent,
  "shortlet-pricing": shortletPricingAgent as AnyAgent,
};

/**
 * For a known agent, re-run its rules over the patched observations extracted
 * from `altTrace` (which has already had patchObs applied to each ghost's obs).
 * Returns the alt trace with ruleId/action/reason replaced by the re-evaluated
 * decisions. The original hashes and state snapshots are intentionally kept as
 * placeholders — they are not used by computeWhatIfDiffs.
 *
 * Returns null for unknown agents (falls back to the unmodified altTrace).
 */
export function rerunAltTrace(
  agentId: string,
  originalTrace: Trace,
  patchedObservations: unknown[],
): Trace | null {
  const agent = AGENT_REGISTRY[agentId];
  if (!agent) return null;

  const decisions = runRules(agent, patchedObservations, originalTrace.options);

  const altGhosts: Ghost[] = originalTrace.ghosts.map((g, i) => {
    const d = decisions[i];
    if (!d) return g;
    return {
      ...g,
      obs: patchedObservations[i] ?? g.obs,
      ruleId: d.ruleId,
      action: d.action,
      reason: d.reason,
    };
  });

  return { ...originalTrace, ghosts: altGhosts };
}
