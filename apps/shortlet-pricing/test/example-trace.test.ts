import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { replay, verifyChain, type Trace } from "../../../packages/core/src/index.js";
import { shortletPricingAgent, type NightObs, type PriceAction, type PricingState } from "../src/agent.js";
import { buildShortletExampleFile } from "../src/example-trace.js";

type ShortletTrace = Trace<PricingState, NightObs, PriceAction>;

// If this fails, run `npm run regen:traces` (rebuilds both bundled traces deterministically).
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

  it("viewer/src/example-trace.json equals what `npm run regen:traces` would generate", () => {
    // If this fails the bundled file is stale: run `npm run regen:traces`.
    expect(file).toEqual(JSON.parse(JSON.stringify(buildShortletExampleFile())));
  });

  it("generation is deterministic (byte-identical JSON on repeat)", () => {
    expect(JSON.stringify(buildShortletExampleFile())).toBe(JSON.stringify(buildShortletExampleFile()));
  });
});
