---
inclusion: always
---
# Structure

```
packages/core/        the skeleton: rng, clock, hash, engine (run, verifyChain, replay, whatIf)
  src/  test/
apps/shortlet-pricing/ demo app 1 (separate folder, depends only on packages/core)
apps/<app-2>/          demo app 2 (separate folder)
docs/ci/               CI workflow template (copy to .github/workflows/ by hand)
.kiro/                 steering, specs, hooks; never gitignored
```

- Apps import core through `packages/core/src/index.ts` only.
- One concept per file in core; keep core dependency-free (Node built-ins only).
