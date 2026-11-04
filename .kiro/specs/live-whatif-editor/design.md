# Design: live-whatif-editor

## Files

- `viewer/src/liveWhatIf.ts` (new, pure, no DOM):
  - `observationToText(obs)`: pretty JSON for the editor.
  - `parseObservationText(text, original)`: returns `{ ok: true, value }` or `{ ok: false, error }` (req 3).
  - `runLiveWhatIf(trace, step, text)`: validates, replaces `obs[step]`, calls `rerunAltTrace`, then `computeWhatIfDiffs`; returns `{ ok: true, altTrace, diffs, changedSteps, step }` or `{ ok: false, error }`. Diffs below `step` are dropped (they can never exist; the filter is a guard).
- `viewer/index.html`: new "Haunt this step" panel (textarea `#live-text`, buttons `#live-haunt` / `#live-reset`, error box `#live-error` with `role="alert"`, result box `#live-result`).
- `viewer/src/main.ts`: `AppState.live` (`{ step, result } | null`); wiring of the panel; shared `diffRowsHtml()` extracted from `renderWhatIf` so scenario and live diffs use the same diff cards; `getChangedSteps()` prefers the live result.
- `viewer/src/style.css`: small styles for the panel.
- `viewer/test/liveWhatIf.test.ts` (new): unit and property-style tests. `fast-check` is not a viewer dependency, so properties use a seeded `createRng` from core to generate observations (still deterministic and reproducible).

## Data flow

```
select step ─▶ textarea = observationToText(ghost.obs)
click Haunt ─▶ parseObservationText ──invalid──▶ #live-error
                    │ valid
                    ▼
        obs[] with obs[step] replaced
                    ▼
   rerunAltTrace(agent, trace, obs[])   (agentRunner: runRules, seed/clock from trace.options)
                    ▼
     computeWhatIfDiffs(trace, alt)  ─▶ diffs, changedSteps
                    ▼
 timeline highlights (.changed) + diff cards in #live-result
Reset ─▶ live = null, text restored, highlights cleared
```

The agent is re-run from step 0 (the RNG and state are sequential, so a suffix-only run would not be faithful); steps before the edit therefore reproduce the original decisions, and "from the edited step onward" is guaranteed by construction and by test.

## Types

```ts
type ParseResult = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };
type LiveResult =
  | { ok: true; step: number; altTrace: Trace; diffs: GhostDiff[]; changedSteps: Set<number> }
  | { ok: false; error: string };
```

## Notes

- Shape check is type-based against the original observation; it does not duplicate agent-specific domain validation.
- Unknown agents return `{ ok: false, error }` (req 8) because `rerunAltTrace` returns `null`.
