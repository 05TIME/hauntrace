# Requirements: tamper-mode (Séance viewer, "Tamper and haunt")

1. The Séance viewer SHALL provide a **Tamper** toggle that reveals a control for rewriting the recorded `reason` (and, in the pure API, `action`) of the currently selected step of the loaded trace.
2. Tampering SHALL NOT recompute any hash (`ghost.hash`, `prevHash`, `headHash` stay as recorded), so the chain breaks.
3. After tampering, the viewer SHALL re-run `verifyChain` and show the break spreading: the tampered step and every later step SHALL be marked **haunted** on the timeline (visual class plus a text marker, not colour alone); steps before it SHALL be unmarked.
4. The chain badge SHALL read `Chain broken at step N`, where N is 1-based and produced by `getBadgeState` (the 0-based `brokenAt` from `verifyChain` + 1), consistent with the timeline labels.
5. An **Exorcise** button, visible only while tampered, SHALL restore the original trace, clear all haunted marks and re-verify to "Chain verified".
6. The loaded (original) trace SHALL never be mutated; tampering operates on a deep copy, and only one step is tampered at a time (re-tampering starts from the original).
7. Pure logic SHALL live in `viewer/src/tamper.ts` (no DOM): `tamperTrace`, `restoreTrace`, `hauntedSteps`, `analyzeTrace`.
8. Behavioural guarantees (tested in `viewer/test/tamper.test.ts`): untampered ⟹ intact and nothing flagged; tampering step k ⟹ broken at k and exactly steps ≥ k flagged; original never mutated; restore ⟹ intact.
9. User-entered text SHALL be HTML-escaped when rendered (the step-detail reason is escaped).
10. Controls SHALL be keyboard accessible, and typing in the tamper text box SHALL NOT trigger the global arrow-key step navigation. Haunted animation SHALL respect `prefers-reduced-motion`.
11. Tamper mode is a viewer-only, in-memory feature: nothing is written to disk and no network is used. Works for both bundled example traces.
12. A second Kiro hook (`.kiro/hooks/sample-traces-replay.kiro.hook`) SHALL ask the agent to regenerate the bundled example traces when `apps/**/*.ts` or `packages/core/**/*.ts` change, and a vitest test SHALL assert both bundled traces pass chain verification and replay with the current code.
