import { run, type Trace } from "../../../packages/core/src/index.js";
import { shortletPricingAgent, type NightObs, type PriceAction, type PricingState } from "./agent.js";
import { sampleNights } from "./sample.js";

/** Run options for the bundled EXAMPLE trace. Shared by the CLI demo and the trace generator. */
export const shortletExampleOptions = { seed: 31, startMs: Date.UTC(2026, 10, 30), stepMs: 60_000 } as const;

export interface ShortletTraceFile {
  schemaVersion: 1;
  trace: Trace<PricingState, NightObs, PriceAction>;
}

/** Pure and deterministic: builds the bundled viewer example file (EXAMPLE data only). */
export function buildShortletExampleFile(): ShortletTraceFile {
  return { schemaVersion: 1, trace: run(shortletPricingAgent, sampleNights, { ...shortletExampleOptions }) };
}
