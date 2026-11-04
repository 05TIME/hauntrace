import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { replay, verifyChain, type Trace } from "../../../packages/core/src/index.js";
import { shortletPricingAgent, type NightObs, type PriceAction, type PricingState } from "../src/agent.js";

type ShortletTrace = Trace<PricingState, NightObs, PriceAction>;

// If this fails, regenerate viewer/src/example-trace.json from the same inputs as `src/cli.ts`
// (sampleNights, seed 31, startMs Date.UTC(2026, 10, 30), stepMs 60_000), wrapped as { schemaVersion: 1, trace }.
describe("bundled shortlet example trace", () => {
  const raw = readFileSync(
    fileURLToPath(new URL("../../../viewer/src/example-trace.json", import.meta.url)),
    "utf8",
  );
  const file = JSON.parse(raw) as { schemaVersion: number; trace: ShortletTrace };

  it("has schemaVersion 1 and the shortlet-pricing agent", () => {
    expect(file.schemaVersion).toBe(1);
    expect(file.trace.agent).toBe(shortletPricingAgent.name);
  });

  it("viewer/src/example-trace.json: chain verifies and replays with the current agent code", () => {
    expect(verifyChain(file.trace).ok).toBe(true);
    expect(replay(shortletPricingAgent, file.trace).ok).toBe(true);
  });
});
