# Hauntrace

> Every decision leaves a ghost you can replay.

Hauntrace is a lean skeleton for **deterministic, replayable, explainable agents**.
You define typed state, rules and actions; a seeded RNG and an injected clock make
every run reproducible, and every step leaves a hash-chained "ghost" trace that says
which rule fired and why. Replay any run exactly, or ask "what if?" and see which
decisions change.

Built for the Kiroween 2026 hackathon (Skeleton Crew category) using Kiro.
See `.kiro/` for specs, steering and hooks.

License: MIT

## Quickstart

```bash
npm install
npm test          # unit + property-based tests
npm run demo:shortlet
```

## Layout

- `packages/core`: the skeleton (`run`, `verifyChain`, `replay`, `whatIf`, seeded `Rng`, injected `Clock`)
- `apps/shortlet-pricing`: demo app 1, nightly pricing on EXAMPLE data
- `apps/<app-2>`: demo app 2 (coming)
- `.kiro/`: Kiro steering, specs and hooks
- `docs/ci/ci.yml`: CI workflow template

## Define an agent

```ts
const agent: AgentDefinition<State, Obs, Action> = {
  name: "my-agent", version: "1", initialState,
  rules: [{ id: "big", description: "n >= 10",
    evaluate: ({ obs }) => obs.n >= 10 ? { action: "alert", reason: `n=${obs.n}` } : null }],
  fallback: () => ({ action: "ignore", reason: "nothing matched" }),
  reduce: (s) => s,
};
const trace = run(agent, observations, { seed: 1, startMs: 0, stepMs: 1000 });
replay(agent, trace).ok; // true
whatIf(agent, trace, (o) => ({ ...o, n: o.n + 5 })).diffs;
```

## Demo app 2: Haunted NPC (`apps/haunted-npc`)
A ghost innkeeper whose dialogue and mood/trust decisions run through the same Hauntrace core: seeded, rule-based, hash-chained, replayable, with a "what if the player had brought the lantern" what-if. Fully deterministic, no network, no API keys.
- `npm run demo:npc` prints the encounter, head hash, replay check and the lantern what-if.
- Open the Séance viewer with `?example=npc` to inspect the bundled NPC trace (`?example=1` loads the short-let trace).
