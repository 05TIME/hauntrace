# Requirements: core engine

1. WHEN an agent runs with seed S and observations O THEN the system SHALL produce the same trace head hash on every run.
2. WHEN a step runs THEN the system SHALL evaluate rules in order and record the first rule that fires, or `fallback` if none fires.
3. Each ghost SHALL record step, time, observation, state before, rule id, reason, action, state after, previous hash and its own hash.
4. The first ghost's previous hash SHALL be 64 zeros; each later ghost SHALL link to the prior ghost's hash.
5. WHEN any ghost field is edited THEN chain verification SHALL fail and report the first broken step.
6. WHEN replaying THEN the system SHALL re-run from recorded inputs and options and confirm every hash matches; it SHALL fail if the ruleset (name, version, rule ids/descriptions) changed.
7. WHEN running a what-if THEN the system SHALL apply a patch to observations, re-run with the same options, return only steps whose rule or action changed, and leave the original trace unchanged.
8. The engine SHALL NOT mutate caller observations or the agent's initial state.
9. Duplicate rule ids, or a rule named `fallback`, SHALL be rejected.
10. Non-finite numbers in traced values SHALL be rejected.
