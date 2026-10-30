# Tasks: haunted-npc

- [x] 1. Types and rules — `EncounterObs`, `NpcState`, `NpcAction`, all six rules + fallback in `agent.ts` (req 1–5)
- [x] 2. EXAMPLE encounter script — six beats covering each rule at least once in `script.ts` (req 6)
- [x] 3. CLI demo — `cli.ts` with ghost printout, head hash, `replay().ok`, and lantern what-if diff (req 7)
- [x] 4. HTTP server — `server.ts` with POST `/run` and GET `/example` (req 8)
- [x] 5. EXAMPLE trace JSON — generate and commit `example-trace-npc.json` (schemaVersion 1, seed 13) (req 9)
- [x] 6. Séance viewer switch — wire `?example=npc` in `viewer/src/main.ts` and register the trace in `traceLoader.ts` (req 10)
- [x] 7. Tests — rule selection per mood/trust/item, `replay()` round-trip, identity what-if (no-op patch), lantern what-if produces expected diffs, property test: same seed + same obs ⟹ same headHash
