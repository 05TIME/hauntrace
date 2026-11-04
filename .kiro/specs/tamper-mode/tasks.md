# Tasks: tamper-mode

- [x] 1. Pure logic — `viewer/src/tamper.ts` with `tamperTrace`, `restoreTrace`, `hauntedSteps`, `analyzeTrace` (req 2, 6, 7)
- [x] 2. Tests — `viewer/test/tamper.test.ts`: intact when untampered, break at k with steps ≥ k flagged, original never mutated, restore intact, 1-based badge label (req 3, 4, 5, 8)
- [x] 3. Viewer UI — Tamper toggle/panel and Exorcise button in `index.html`; wiring in `main.ts` (req 1, 5, 6)
- [x] 4. Haunted timeline — `.haunted`/`.tampered` classes, text markers, aria-labels, step-detail note, CSS with reduced-motion support (req 3, 10)
- [x] 5. Safety — escape user-entered reason in step detail; keep arrow-key navigation out of the text box (req 9, 10)
- [x] 6. Hook — `.kiro/hooks/sample-traces-replay.kiro.hook` in the same format as `determinism-tests.kiro.hook` (req 12)
- [x] 7. Bundled-trace tests — `apps/haunted-npc/test/example-trace.test.ts` and `apps/shortlet-pricing/test/example-trace.test.ts`: `verifyChain` + `replay` on both bundled traces (req 12)
- [x] 8. Spec — requirements, design, tasks in `.kiro/specs/tamper-mode/`
