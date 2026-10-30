import type { Clock } from "./clock.js";
import type { Rng } from "./rng.js";

/** Everything a rule may look at. No other inputs are allowed. */
export interface RuleContext<S, O> {
  state: Readonly<S>;
  obs: Readonly<O>;
  step: number;
  clock: Clock;
  rng: Rng;
}

export interface RuleResult<A> {
  action: A;
  /** Human-readable explanation of why this rule fired. */
  reason: string;
}

/** A rule returns a result when it fires, or null when it does not apply. */
export interface Rule<S, O, A> {
  id: string;
  description: string;
  evaluate(ctx: RuleContext<S, O>): RuleResult<A> | null;
}

export interface AgentDefinition<S, O, A> {
  name: string;
  version: string;
  initialState: S;
  /** Ordered rules; the first that fires wins. */
  rules: ReadonlyArray<Rule<S, O, A>>;
  /** Action when no rule fires. */
  fallback: (ctx: RuleContext<S, O>) => RuleResult<A>;
  /** Pure state transition. */
  reduce: (state: S, obs: O, action: A) => S;
}

export interface RunOptions {
  seed: number;
  startMs: number;
  stepMs: number;
}

export interface Ghost<S, O, A> {
  step: number;
  timeMs: number;
  obs: O;
  stateBefore: S;
  ruleId: string;
  reason: string;
  action: A;
  stateAfter: S;
  prevHash: string;
  hash: string;
}

export interface Trace<S, O, A> {
  agent: string;
  agentVersion: string;
  rulesetHash: string;
  options: RunOptions;
  ghosts: Ghost<S, O, A>[];
  headHash: string;
}
