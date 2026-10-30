# Design: core engine

- `createRng(seed)`: mulberry32; `next()` in [0,1), `int(min,max)` inclusive.
- `steppedClock(start, step)`: `now()` + `tick()`; the engine ticks after each step.
- `canonicalJson` / `hashValue`: sorted keys, undefined dropped, -0 => 0, NaN/Infinity rejected; sha256 hex.
- `AgentDefinition<S,O,A>`: `{ name, version, initialState, rules[], fallback, reduce }`.
- `run(agent, obs[], {seed,startMs,stepMs}) => Trace` with `rulesetHash` and `headHash`.
- `verifyChain(trace)`: recompute each ghost hash from its body and check links.
- `replay(agent, trace)`: verifyChain + ruleset check + rerun and compare hashes.
- `whatIf(agent, trace, patch)`: rerun patched inputs; diff by rule id and canonical action hash.
- Inputs and state are `structuredClone`d at each boundary so rules cannot leak mutation.

Later (tasks 6+): HTTP adapter with schema validation, LLM-tool adapter (LLM proposes, agent decides), "Séance" trace viewer UI.
