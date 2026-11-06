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

## Shareable ghost links + Explain this run (feat/share-explain)
- **Spec:** `.kiro/specs/share-explain/` (requirements, design, tasks) was written before the code, in the first session.
- **Session 1, complete implementation:** an AI coding session in the Kiro CLI default agent, restricted to file read/write tools (no shell, git or network). It wrote the spec and added `viewer/src/shareLink.ts` (`#t=` fragment codec: deflate-raw + base64url, plain fallback, size caps), `packages/core/src/explain.ts` (pure, import-free story generator shared by viewer and CLI), `packages/core/src/explain-cli.ts` and the `explain` npm script, plus the viewer button, startup load and collapsible "Explain this run" panel, and tests (`viewer/test/shareLink.test.ts`, `viewer/test/explainRun.test.ts`, `packages/core/test/explain.test.ts`).
- **Review session 2 (encoder hardening):** the encoder now rejects JSON over `MAX_DECODED_BYTES` before compressing, falls back to plain encoding if `deflate-raw` is unsupported, and reports a clear error if a compressed link cannot be decompressed. Added tests for those paths, a garbage-payload fuzz and explanation edge cases; the README documents link privacy, limits and browser support.
- **Review session 3 (startup precedence blocker):** review found that a share link made while viewing `?example=` kept that query, and `?example=` took precedence over `#t=`, so the wrong run could open. Added the pure helper `viewer/src/startupSelection.ts` (`selectStartup`): a `#t=` payload always wins over `?example`/`?whatif`, and an empty or malformed payload shows an error instead of loading a sample. Added `viewer/test/startupSelection.test.ts`; updated spec, design, tasks and README.
- **Review session 4 (security, HTML injection):** review found legacy `innerHTML` templates in `viewer/src/main.ts` interpolating raw trace values (rule label, action text, reason, obs/state/action JSON, hashes), which a malicious shared trace could use to inject HTML. Added the pure `viewer/src/escapeHtml.ts` (`escapeHtml`, `escapeJson`) and applied it to the badge, timeline, step detail and what-if rendering (the existing local `escHtml` now delegates to it); meta bar and story already used `textContent`. `formatTime` now survives out-of-range `timeMs`. Added `viewer/test/escapeHtml.test.ts`; updated spec requirement 15 and task 12.
- **Review session 5 (stale verification result):** `loadTrace` awaited `verifyChain(trace)` and then rendered the badge and explanation for whatever trace was current, so a slower earlier load could paint its result onto a newer run. Added a guard right after the await (`if (state?.trace !== trace) return;`) so only the same trace instance is rendered. Minimal change in `viewer/src/main.ts`; no new test (the logic lives in the DOM-bound `main.ts`, which has no test harness).
- **Not verified:** none of these sessions ran typecheck, tests or builds (shell disabled by design); the code was checked by reading only. No claim is made that tests pass. The coordinator must rerun `npm run typecheck && npm test && npm run build` after this security change.
- Hand edits: none to the code at the time of writing.

### Coordinator verification
- After all Kiro review sessions (including HTML escaping and stale-result guards), the coordinating assistant reran `npm test`: 148 core/app + 210 viewer = 358 passing tests. `npm run typecheck`, `npm run build`, and `npm --prefix viewer run build` also passed. The Explain CLI was smoke-tested against both bundled traces. Kiro performed no shell or git operations. This paragraph is a coordinator documentation edit.
