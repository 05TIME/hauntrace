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
- `apps/haunted-npc`: demo app 2, a ghost innkeeper NPC (`npm run demo:npc`)
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
- Press **Tamper** in the viewer to alter one recorded step without re-hashing and watch the chain break spread from that step; **Exorcise** restores the original.
- `npm run regen:traces` rebuilds both bundled example traces deterministically (the `sample-traces-replay` Kiro hook runs it when core/app `.ts` files change); tests fail if a bundled trace is stale.
- In the viewer, pick a step, edit its observation in the "Haunt this step" panel and see which later decisions change (live what-if); Reset restores the original run.
- The viewer features compose: live edits and scenarios are mutually exclusive, while Tamper/Exorcise (which only touch recorded reasons and hash verification, never observations) can be used before, during or after a live edit.

## Share and explain

### Share links
Séance has a **Copy share link** button. It puts the trace in the URL fragment (`#t=...`); opening that link loads the trace and re-verifies the hash chain, so a tampered link shows the broken badge. A `#t=` payload always takes precedence over `?example=` and `?whatif=`: a share link opens the shared run even if the URL still carries `?example=`. An empty or malformed payload shows an error; it never falls back to a sample.

- **What is shared: the recorded trace on screen.** The link contains exactly the trace currently displayed. If you pressed **Tamper**, the link carries that exact tampered (broken) run, and whoever opens it sees the broken-chain badge and "BROKEN" in the story. After **Exorcise** the restored trace is shared again. If the file you loaded was already broken, Exorcise restores it as loaded (still broken), because the pristine original is not known.
- **Live what-if edits and scenarios are not shared.** "Haunt this step" edits and the scenario dropdown are overlays computed from the displayed trace, not part of it, so a link never contains them and the opener starts without any overlay. Tamper changes the recorded trace and is shared; live edits and scenarios change nothing recorded and are not.
- **Privacy: the whole trace is in the link.** Every observation, state, action and reason is encoded into the URL (compressed, but not encrypted). Anyone who has the link can read all of it, and it can end up in chat history, browser history or logs of whatever you paste it into. Do not share traces that contain private data. The fragment is not sent to the server by browsers when requesting the page, and Hauntrace makes no network calls itself.
- **Size limits:** the trace JSON must be at most 2 MiB (checked before compressing) and the encoded payload at most 200,000 characters. Larger traces are refused with a message; use *Open Trace File* with an exported JSON file instead. Many chat apps and some servers truncate very long URLs, so keep shared traces small. Oversized, malformed or decompression-bomb links are rejected with a message.
- **Browser support:** links are compressed with `CompressionStream("deflate-raw")` (current Chrome, Edge, Safari 16.4+, Firefox 113+). If the browser lacks it, or rejects `deflate-raw`, the link is created uncompressed (`#t=p.…`, larger but readable by every browser). Opening a compressed (`z.`) link needs `DecompressionStream`; browsers without it show a clear error. Copying uses `navigator.clipboard`, which needs HTTPS or localhost.
- A link is not a proof of authenticity: the chain check detects edits to individual steps, but someone can still share a complete, self-consistent trace they made up.

### Explain this run
The collapsible **Explain this run** panel tells the run as a step-by-step story: for each step the time, which rule fired (or that the fallback decided), why, and the action chosen, then whether the hash chain verifies. The text is deterministic: the same trace always gives the same story. It always describes the displayed recorded trace and refreshes after Tamper and Exorcise (it ignores live what-if overlays). From the terminal: `npm run explain -- path/to/trace.json` (exit code 0 verified, 1 chain broken, 2 bad input).
