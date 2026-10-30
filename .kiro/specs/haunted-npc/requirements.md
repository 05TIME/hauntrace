# Requirements: haunted-npc (app 2)

1. The app SHALL model a ghost innkeeper NPC whose dialogue and behaviour are decided by the Hauntrace core engine (`run`, `replay`, `whatIf`).
2. Each step represents one player encounter beat; the observation SHALL carry: `beat` (scene id), `playerTrust` (0–100), `hasLantern` (bool), `hasRelicKey` (bool), `hourOfNight` (0–23), and an optional `playerAction` string.
3. NPC state SHALL track `mood` (`hostile | wary | neutral | warm | haunted`), `trustDelta` (cumulative), and `beatsPlayed`.
4. Rule priority order (first match wins):
   - `betray`: player is known to have stolen the relic key and trust < 20 → NPC blocks the door, mood → hostile.
   - `lantern-gift`: player offers lantern in `wary` or `neutral` mood → NPC mood → warm, trust +15, grants passage.
   - `midnight-dread`: hour is 0–3 and mood is not `haunted` → NPC enters haunted trance, delivers cryptic monologue.
   - `high-trust`: trust ≥ 70 → NPC shares a secret and mood → warm.
   - `low-trust`: trust ≤ 20 and mood not `hostile` → NPC delivers a warning, mood → wary.
   - `fallback`: seeded random dialogue line from a small fixed table; mood unchanged.
5. Every NPC response SHALL carry a plain-language `reason` and a `dialogue` string.
6. All demo data SHALL be synthetic and labelled EXAMPLE.
7. The demo SHALL show a replay verification and a what-if (e.g. "what if the player had brought the lantern") with differing beats highlighted.
8. The app SHALL expose an HTTP server entry (`server.ts`) matching the pattern of `apps/shortlet-pricing/src/server.ts`.
9. The app SHALL export a static EXAMPLE trace JSON (`example-trace-npc.json`) loadable by the Séance viewer (`viewer/`).
10. The Séance viewer SHALL support `?example=npc` to load the NPC example trace automatically.
