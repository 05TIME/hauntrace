# Tasks: tamper-mode

- [x] 1. Pure logic — `viewer/src/tamper.ts` with `tamperTrace`, `restoreTrace`, `hauntedSteps`, `analyzeTrace` (req 2, 6, 7)
- [x] 2. Tests — `viewer/test/tamper.test.ts`: intact when untampered, break at k with steps ≥ k flagged, original never mutated, restore intact, 1-based badge label (req 3, 4, 5, 8)
- [x] 3. Viewer UI — Tamper toggle/panel and Exorcise button in `index.html`; wiring in `main.ts` (req 1, 5, 6)
- [x] 4. Haunted timeline — `.haunted`/`.tampered` classes, text markers, aria-labels, step-detail note, CSS with reduced-motion support (req 3, 10)
- [x] 5. Safety — escape user-entered reason in step detail; keep arrow-key navigation out of the text box (req 9, 10)
- [x] 6. Hook — `.kiro/hooks/sample-traces-replay.kiro.hook` in the same format as `determinism-tests.kiro.hook` (req 12)
- [x] 7. Bundled-trace tests — `apps/haunted-npc/test/example-trace.test.ts` and `apps/shortlet-pricing/test/example-trace.test.ts`: `verifyChain` + `replay` on both bundled traces (req 12)
- [x] 8. Spec — requirements, design, tasks in `.kiro/specs/tamper-mode/`

- [x] 9. Review fixes — deterministic `npm run regen:traces` (builders + generators), generator output paths fixed, hook updated, staleness/determinism tests, loaded-broken traces flagged, wider HTML escaping (req 9, 12, 13). Not executed inside Kiro (no shell): run `npm test`, `npm run viewer:build` and `npm run build` to confirm.
- [x] 10. Integration with live-whatif-editor (merge of main): both feature sets kept in `main.ts`; `setStep` re-syncs the tamper input AND resets the live editor; scenario "none" re-render preserves live "changed" marks; tamper apply button renamed "Tamper selected step"; `viewer/test/integration.test.ts` covers the pure-module composition on both bundled traces. DOM wiring (mutual exclusion, prefill) is not unit-tested.
