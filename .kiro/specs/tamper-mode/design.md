# Design: tamper-mode

## Files

- `viewer/src/tamper.ts`: pure logic, no DOM (req 7).
  - `tamperTrace(original, stepIndex, edit?)`: `structuredClone` the trace, overwrite `reason`/`action` of one ghost, leave all hashes untouched. Default edit appends ` [tampered]` to the reason so the hashed body always changes. Throws `RangeError` for a bad index.
  - `restoreTrace(original)`: fresh deep copy (Exorcise).
  - `hauntedSteps(result, totalSteps)`: `Set` of 0-based indices `brokenAt..totalSteps-1`; empty if `ok` or if the break has no step (headHash mismatch).
  - `analyzeTrace(trace)`: `verifyChain` + `getBadgeState` + `hauntedSteps` in one call.
- `viewer/test/tamper.test.ts`: untampered intact; tamper k ⟹ `brokenAt === k` and flagged set equals `{k..n-1}` for every k; badge label has `step k+1`; original deep-equal before/after; restore intact.
- `viewer/index.html`: `.tamper-section` with `#btn-tamper` (toggle, `aria-expanded`), `#tamper-panel` (`#tamper-reason`, `#btn-tamper-apply`), `#btn-exorcise` (hidden until tampered), `#tamper-status` (`role=status`).
- `viewer/src/main.ts`: `AppState` gains `original` and `tamperedStep`; module-level `haunted` set. `renderTimeline` adds `.haunted` / `.tampered` classes, an aria-label suffix and a visible `🪦 tampered` / `👻 haunted` marker. `applyTamper` always tampers from `state.original`; `exorcise` restores it; both call `reverifyAndRender`, which ignores stale async results. Step-detail reason is now `escHtml`-escaped. The global arrow-key handler ignores input/select targets (except the scrubber).
- `viewer/src/style.css`: `.timeline-item.haunted` (red dotted border, strike-through action, flicker animation disabled under `prefers-reduced-motion`), `.tampered` (solid), tamper panel styles.
- `.kiro/hooks/sample-traces-replay.kiro.hook`: same JSON shape as `determinism-tests.kiro.hook` (same name/description/version/when/then keys and the same `fileEdited` patterns); `askAgent` runs `npm run regen:traces` then `npm test`.
- `apps/*/src/example-trace.ts` (pure builders + run options, shared with the CLIs) and `apps/*/src/generate-trace.ts` (write the JSON from the repo root; cwd-based, they refuse to run elsewhere). Root script `regen:traces` = build + both generators. The NPC generator writes both the app copy and the viewer copy.
- `apps/haunted-npc/test/example-trace.test.ts`, `apps/shortlet-pricing/test/example-trace.test.ts`: read the bundled JSON, assert core `verifyChain` ok, `replay(agent, trace)` ok, bundled == freshly generated, generation deterministic. One file per app so apps never import each other.

## Index convention

All internal indices are 0-based (`Ghost.step`, `brokenAt`). Only user-facing text is 1-based: `getBadgeState` adds 1 for the badge, the timeline shows `Step i+1`.

## Data flow

```
loaded Trace ──restoreTrace──> state.original (never mutated)
click "Haunt selected step":
  tamperTrace(original, k, edit) ──> state.trace (hashes stale)
    └─ analyzeTrace ──> { result, badge "Chain broken at step k+1", hauntedSteps {k..n-1} }
         └─ badge, timeline (.haunted), step-detail note, status line
click "Exorcise": restoreTrace(original) ──> analyzeTrace ──> "Chain verified", no marks
```

## Why steps after k are "haunted"

`verifyChain` stops at the first mismatch. Later ghosts may still be self-consistent against their own `prevHash`, but each one's `prevHash` descends from the tampered ghost, so none can be trusted. The viewer flags them as a presentation of that fact.
