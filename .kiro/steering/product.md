---
inclusion: always
---
# Product: Hauntrace

Hauntrace is a lean skeleton for deterministic, replayable, explainable agents.
Category target: Kiroween 2026 **Skeleton Crew**: one template, two distinct apps.

- Users: developers who need auditable automated decisions (pricing, triage, game logic).
- Promise: same seed + same inputs => same decisions and the same trace hash, every time.
- Every step leaves a "ghost": inputs, state before/after, the rule that fired, the reason, the action, chained by sha256.
- Replay verifies a run; what-if patches inputs and shows only the decisions that changed.
- App 1: short-let apartment nightly pricing (EXAMPLE data, always labelled as example).
- App 2: TBD (e.g. support-ticket triage or a game NPC), in its own folder under `apps/`.
- Tone: spooky naming is welcome in UI and docs; the core API stays plain and precise.
