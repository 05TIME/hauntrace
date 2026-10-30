# Design: haunted-npc

## Files

- `apps/haunted-npc/src/agent.ts`: `EncounterObs`, `NpcState`, `NpcAction`, and the six rules (req 3–5). Fallback picks a dialogue line via `rng.int(0, table.length - 1)`; all other rules are pure conditionals. No `Date.now()`, no `Math.random()`.
- `apps/haunted-npc/src/script.ts`: EXAMPLE six-beat encounter script covering each rule at least once, labelled EXAMPLE.
- `apps/haunted-npc/src/cli.ts`: runs the agent, prints each ghost (beat, rule, dialogue, mood), prints head hash, confirms `replay().ok`, then runs a what-if patching `hasLantern: true` on the beat where the player arrived without one and prints only changed beats.
- `apps/haunted-npc/src/server.ts`: tiny `http.createServer` handler — POST `/run` accepts `{ obs[], seed, startMs, stepMs }`, returns the `Trace` JSON; GET `/example` returns the static EXAMPLE trace. Mirrors the shortlet-pricing server shape.
- `apps/haunted-npc/src/example-trace-npc.json`: static pre-generated EXAMPLE trace (schemaVersion 1, six ghosts, seed 13) committed to the repo and consumed by the server's GET `/example` and the viewer.

## Séance viewer extension

- `viewer/src/traceLoader.ts`: add `"npc"` as a recognised key next to any existing `"shortlet"` key in the built-in example map.
- `viewer/src/main.ts`: on load, read `?example=npc`; if present, fetch `example-trace-npc.json` from the NPC app's static path and pass to `parseTraceFile`.
- The viewer otherwise needs no changes; the NPC trace is a valid schemaVersion 1 `TraceFile`.

## Data flow

```
script.ts (EncounterObs[]) → run(agent, obs, {seed:13, startMs, stepMs}) → Trace
  ├── cli.ts  prints ghosts, replay, what-if diff
  └── server.ts  POST /run | GET /example
        └── viewer ?example=npc  renders ghosts in Séance
```

## Types

```ts
type Mood = "hostile" | "wary" | "neutral" | "warm" | "haunted";

interface EncounterObs {
  beat: string;          // scene id, e.g. "inn-door"
  playerTrust: number;   // 0–100
  hasLantern: boolean;
  hasRelicKey: boolean;
  hourOfNight: number;   // 0–23
  playerAction?: string; // optional, e.g. "offer-lantern"
}

interface NpcState {
  mood: Mood;
  trustDelta: number;
  beatsPlayed: number;
}

interface NpcAction {
  dialogue: string;
  moodAfter: Mood;
  trustChange: number;
}
```
