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
