# Tasks: live-whatif-editor

- [x] 1. Pure module `viewer/src/liveWhatIf.ts` — `observationToText`, `parseObservationText`, `runLiveWhatIf` (req 2–5, 7, 8, 11)
- [x] 2. Editor panel markup in `viewer/index.html` and styles in `style.css` (req 1, 3, 9, 12)
- [x] 3. Wire panel in `viewer/src/main.ts`: prefill on step change, Haunt, Reset, error display (req 1–3, 9)
- [x] 4. Timeline highlights and shared diff-card rendering for live results (req 6)
- [x] 5. Scenario/live mutual exclusion (req 10)
- [x] 6. Tests `viewer/test/liveWhatIf.test.ts` — unedited ⟹ zero diffs, determinism, invalid JSON rejected, shape errors, earlier steps unchanged, real edit changes a decision, unknown agent (req 4, 5, 7, 8, 11)
