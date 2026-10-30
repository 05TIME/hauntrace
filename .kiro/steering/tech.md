---
inclusion: always
---
# Tech

- TypeScript (strict, NodeNext ESM), Node 20+, vitest + fast-check for property-based tests.
- Determinism rules (non-negotiable inside rules, fallback and reduce):
  - No `Date.now()`, `new Date()` without args, `Math.random()`, network, filesystem or env reads.
  - Time comes from the injected `Clock`; randomness from the seeded `Rng`.
  - Rules are pure functions of `RuleContext`; `reduce` is a pure state transition.
  - Trace values must be JSON-safe and finite; hashing uses canonical (sorted-key) JSON.
- Every new behaviour gets a unit test; invariants (determinism, replay, identity what-if) get property tests.
- Before pushing: `npm run typecheck && npm test && npm run build`.
- No secrets in the repo. Demo data is synthetic and labelled EXAMPLE.
