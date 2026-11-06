# How Kiro is used (running log)

Kiroween 2026 requires a write-up of Kiro usage. This file is updated as the build progresses.

- Steering (`.kiro/steering/`): product, tech (determinism rules), structure.
- Specs (`.kiro/specs/`): `core-engine` and `shortlet-pricing`, each with requirements, design, tasks.
- Hooks (`.kiro/hooks/`): run determinism tests on save.
- Property-based tests (fast-check) back the determinism, replay and identity what-if requirements.

## Honest provenance

- **Initial scaffold (PR #1):** written outside Kiro by an AI assistant, following the plan and the `.kiro` steering/specs above. Spec tasks 1-5 and the shortlet demo came from that scaffold, not from Kiro.
- **Core task 6, trace export/import (PR #2):** implemented by **Kiro CLI 2.36.0** (free plan) in one non-interactive, spec-driven session run from the repo root, so Kiro loaded the `.kiro` steering and specs:
  `kiro-cli chat --no-interactive --trust-all-tools --trust-workspace "Implement task 6 in .kiro/specs/core-engine/tasks.md ..."`
  Kiro read the spec and code, created `packages/core/src/io.ts` (`TRACE_SCHEMA_VERSION`, `exportTrace`, `importTrace`, `TraceImportError`) and `packages/core/test/io.test.ts` (24 tests: round-trip with replay/verify, a property test, and validation failures), exported it from `index.ts`, ran typecheck and tests, and ticked task 6 in `tasks.md`.
  Hand edits: none to the code. Only this file was updated by hand.

- **Core task 7, HTTP adapter (PR #3):** implemented by Kiro CLI (free plan) in one non-interactive, spec-driven session (`"Implement task 7 in .kiro/specs/core-engine/tasks.md ..."`). Kiro created `packages/core/src/http.ts` (`createAgentServer`, `node:http` only, `POST /run` returning trace + replay verification and optional what-if ghost diffs; 400/404/405 errors), `apps/shortlet-pricing/src/server.ts` (`createShortletServer`), and tests (`packages/core/test/http.test.ts`, `apps/shortlet-pricing/test/server.test.ts`, 35 tests bound to 127.0.0.1 on an ephemeral port). It fixed its own typecheck error, ran typecheck/tests/build, and ticked task 7.
  Hand edits: none to the code. Only this file was updated by hand.
- **Core task 8, LLM tool adapter (PR #4):** implemented by Kiro CLI (free plan) in one non-interactive, spec-driven session (`"Implement task 8 in .kiro/specs/core-engine/tasks.md ..."`), prompted to stay provider-agnostic, need no API key, call no real LLM or network service, and add no dependencies. Kiro created `packages/core/src/llm.ts` (`createAgentTool` returning a JSON-Schema tool `definition`, `handle` and `handleRaw` that validate the LLM's proposed action, run the engine, and return trace, replay verification, divergences where the rules overrode the LLM (with reasons), and optional what-if; `ToolInputError`) and `packages/core/test/llm.test.ts` (50 tests, fakes only). It exported it from `index.ts`, ran typecheck/tests/build, and ticked task 8.
  Hand edits: none to the code. Only this file was updated by hand.
- **Core task 9, "Séance" trace viewer (this PR):** implemented by Kiro CLI (free plan) in two non-interactive, spec-driven sessions. Session 1 (`"Implement task 9 in .kiro/specs/core-engine/tasks.md ..."`, prompted for a static Vite build with no network calls, no analytics, iPad Safari layout, exported-trace or bundled EXAMPLE loading, timeline, hash-chain badge and what-if ghost diff) built `viewer/` (Vite + TypeScript, no runtime dependencies: `traceLoader`, `verifyChain` via SubtleCrypto, `scrubberState`, `whatIfDiff`, Halloween CSS, bundled `example-trace.json`, 41 viewer tests) and the root `viewer:dev`/`viewer:build` scripts, then was cut off by a service throttling error before finishing. After a ~15 minute wait, session 2 (a short continue prompt) checked the work, confirmed the root `npm test` runs the 119 engine tests plus the 41 viewer tests, and ticked task 9.
  Hand edits: none to the code. Only this file was updated by hand. Screenshots were taken with headless Chrome outside Kiro.

## Next
- Continue the remaining spec tasks with Kiro and log spec vs vibe choices here.

## Viewer polish (fix/viewer-polish)
- Implemented by Kiro CLI (free plan) in one short non-interactive session (no throttling). Kiro added a pure `getBadgeState` module (`viewer/src/getBadgeState.ts`) so the hash-chain badge shows a neutral "No trace loaded" state before a trace is loaded, plus 11 new viewer tests. It aligned viewer dev tooling with the root project (vitest ^5.0.5, typescript ^7.0.2, @types/node ^26.6.6; vite bumped to ^6 because vitest 5 needs it) and added `?example=1` to auto-load the bundled EXAMPLE trace (no network).
  Hand edits: none to the code. Only this file was updated by hand. Screenshots were taken with headless Chrome outside Kiro.

## Demo app 2: haunted-npc (feat/npc-demo)
- **Spec:** Kiro CLI wrote `.kiro/specs/haunted-npc/` (requirements, design, 7 tasks) in one session before any code.
- **Implementation:** a Kiro session implemented the tasks (`apps/haunted-npc`: agent rules, encounter script, CLI, server, trace generator, exported `example-trace-npc.json`, tests) plus the viewer `?example=npc` switch and the empty-scrubber "No steps" fix, then was cut off by a service throttling error. After a ~15 minute wait, a short continue session verified everything, confirmed the tests and builds, and ticked all 7 tasks.
- **Viewer fix:** a further short Kiro session added `formatAction` (tested) and CSS clipping because NPC timeline cards showed raw action JSON overlapping each other.
- Hand edits: added the missing `demo:npc` script line to `package.json` (Kiro created `cli.ts` but not the script), plus this file and the README section. Screenshots were taken with headless Chrome outside Kiro.

## Per-app what-if scenarios (fix/viewer-whatif-per-app)
- Session 1 (Kiro CLI): added `viewer/src/scenarioRegistry.ts` (agent id -> scenarios; shortlet unchanged, 5 haunted-npc scenarios, "No what-if scenarios for this agent" for unknown agents), rebuilt the dropdown per trace, and added `?whatif=<id>`, plus tests.
- Review found a real bug in that change: the alternate run only patched observations and never re-ran the rules, so every scenario showed "No decisions changed". Session 2 (Kiro) started an in-browser re-run (`viewer/src/agentRunner.ts`) and was cut off by a service throttling error. After a ~15 minute wait, session 3 (Kiro) finished it: the viewer now re-runs the real agent rules (node:crypto shimmed out; hashing is not needed for the diff), with tests asserting real decision changes (lantern changes step 1 for the NPC; no-events changes the event-surge step for short-let).
- Hand edits: none to the code. Only this file was updated by hand. Screenshots were taken with a headless Chrome script outside Kiro.

## Readable what-if diff cards (fix/viewer-diff-cards)
- One Kiro CLI session (no throttling) added a pure, tested `viewer/src/formatDiffCard.ts` (23 tests): haunted-npc cards show rule, mood, trust change and the dialogue line (original crossed out -> scenario); short-let cards show rule, price and multiplier; unknown agents get a compact summary. A native `<details>` "Raw data" toggle keeps the full JSON, and CSS wrapping prevents overflow at 1024x1366 and 1366x1024.
- Hand edits: none to the code. Only this file was updated by hand. Screenshots were taken with a headless Chrome script outside Kiro.

- **Viewer badge step number (fix/viewer-broken-step-number):** Kiro CLI made the whole code change: `getBadgeState` now shows `brokenAt + 1` so the "Chain broken at step N" badge matches the 1-based timeline (core `verifyChain` stays 0-based), updated two unit tests that encoded the old numbering, and added `viewer/test/chainBreakBadge.test.ts` (tampered NPC trace regression). No throttles. Hand edits: this KIRO_USAGE.md entry only.

## Tamper and haunt mode + second hook (feat/tamper-mode)
- One Kiro CLI session (non-interactive, file tools only) wrote `.kiro/specs/tamper-mode/`, implemented `viewer/src/tamper.ts` (alter one step without re-hashing, re-verify, flag every step from the break onward, restore) with `viewer/test/tamper.test.ts`, added the Tamper / "Tamper selected step" / Exorcise controls and haunted timeline styling, escaped step-detail reasons in `main.ts`, and created the second hook `.kiro/hooks/sample-traces-replay.kiro.hook` plus tests that both bundled example traces still verify and replay. (The apply button was originally labelled "Haunt selected step"; it was renamed during integration to avoid clashing with the live editor's "Haunt this step".)
- Review session (Kiro CLI, file read/write tools only: no shell, so nothing was executed, and `npm test` and the viewer/root builds were left for the user to run outside Kiro). Changes:
  - Real bug fixed: `apps/haunted-npc/src/generate-trace.ts` wrote its output next to the compiled script (under `dist/`), so the old hook instruction ("copy apps/haunted-npc/src/example-trace-npc.json") could copy a stale file. Generators now write to the real source paths from the repo root.
  - Real bug fixed: a loaded trace that was already broken got a "Chain broken" badge but no haunted marks; `loadTrace` now goes through the same `reverifyAndRender` path (with stale-result protection) as Tamper/Exorcise.
  - Hardening: the step-detail JSON blocks, hashes, rule label, and timeline action/date/rule text are now HTML-escaped (previously only the reason was).
  - New deterministic script `npm run regen:traces` (build, then `apps/*/src/generate-trace.ts` via pure `example-trace.ts` builders). The shortlet trace no longer has to be reconstructed by an agent by hand. The hook now just runs this script, then `npm test`.
  - New tests: each bundled trace must equal what the generator would produce (staleness check), and generation is byte-deterministic.
- Hand edits: this entry and the README lines.

### Coordinator verification
- After the Kiro file-only sessions, the coordinating assistant ran `npm test` (148 core/app + 177 viewer = 325 tests, all passing), `npm run typecheck`, `npm run build`, and `npm --prefix viewer run build` successfully. `npm run regen:traces` also completed successfully; both regenerated samples verified and replayed. (This was before the live-whatif-editor merge; the merged result must be re-verified.)

## Live what-if editor (feat/live-whatif-editor)
- Session 1 (Kiro CLI, non-interactive, file tools only): wrote `.kiro/specs/live-whatif-editor/` (requirements, design, 6 tasks), then implemented `viewer/src/liveWhatIf.ts` (parse/validate an edited observation, re-run the agent in the browser, diff from the edited step on), the "Haunt this step" panel with Reset and timeline highlights in `main.ts`/`index.html`/`style.css`, and `viewer/test/liveWhatIf.test.ts` (seeded random edits, zero-diff on unedited input, invalid input rejected).
- Session 2 (Kiro): one seeded test failed; Kiro diagnosed that the test deleted an optional field the strict validator treats as required, and fixed the test.
- Hand edits: this entry and the README line. Tests and builds were run outside Kiro (Kiro had no shell access).

## Integration: tamper-mode + live-whatif-editor (merge of main into feat/tamper-mode)
- Kiro CLI (file read/write tools only, no shell/git) resolved the conflicts in `viewer/src/main.ts`, `README.md` and this file, keeping both features: the live editor (`live-text`, `live-haunt`, `live-reset`, per-step prefill, scenario/live mutual exclusion) and tamper (`btn-tamper`, `tamper-reason`, Exorcise, haunted marks, stale-verification guard, escaping). `setStep` now both re-syncs the tamper input and resets the live editor; the "no scenario" branch of `renderWhatIf` keeps live "changed" marks so a Tamper/Exorcise re-render does not erase them; `reverifyAndRender` also re-renders the live result. The tamper apply button was renamed "Tamper selected step". `viewer/index.html` and `style.css` merged automatically and were reviewed.
- Added `viewer/test/integration.test.ts` (pure modules only: live edits and tamper/restore on both bundled traces). Not executed inside Kiro; run `npm test` and the builds outside.
- Post-integration coordinator validation: `npm test` passed (148 core/app + 235 viewer = 383 tests); root typecheck/build, viewer build and deterministic sample regeneration also passed.
