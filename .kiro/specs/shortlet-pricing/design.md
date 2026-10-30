# Design: short-let pricing

- `apps/shortlet-pricing/src/agent.ts`: `NightObs`, `PricingState`, `PriceAction`, rules per requirements.
- `src/sample.ts`: five EXAMPLE nights covering each rule.
- `src/cli.ts`: prints ghosts, head hash, replay result and a what-if diff.
- Later: a small web page that calls the HTTP adapter and renders the Séance viewer.
