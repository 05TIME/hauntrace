# How Kiro is used (running log)

Kiroween 2026 requires a write-up of Kiro usage. This file is updated as the build progresses.

- Steering (`.kiro/steering/`): product, tech (determinism rules), structure.
- Specs (`.kiro/specs/`): `core-engine` and `shortlet-pricing`, each with requirements, design, tasks.
- Hooks (`.kiro/hooks/`): run determinism tests on save.
- Property-based tests (fast-check) back the determinism, replay and identity what-if requirements.
- Next: continue the remaining spec tasks inside the Kiro IDE and log spec vs vibe choices here.
