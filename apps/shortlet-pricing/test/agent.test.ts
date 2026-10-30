import { describe, expect, it } from "vitest";
import { replay, run, whatIf } from "../../../packages/core/src/index.js";
import { shortletPricingAgent } from "../src/agent.js";
import { sampleNights } from "../src/sample.js";

const opts = { seed: 31, startMs: 0, stepMs: 1000 };

describe("shortlet pricing agent", () => {
  it("explains each night with the expected rule", () => {
    const t = run(shortletPricingAgent, sampleNights, opts);
    expect(t.ghosts.map((g) => g.ruleId)).toEqual(["last-minute", "fallback", "weekend", "high-demand", "event-surge"]);
    expect(t.ghosts[0]!.action.price).toBe(80);
    expect(t.ghosts[4]!.action.price).toBe(135);
  });
  it("keeps prices within floor and ceiling", () => {
    const rich = { ...shortletPricingAgent, initialState: { ...shortletPricingAgent.initialState, basePrice: 190 } };
    const t = run(rich, sampleNights, opts);
    for (const g of t.ghosts) expect(g.action.price).toBeLessThanOrEqual(200);
  });
  it("replays exactly", () => {
    expect(replay(shortletPricingAgent, run(shortletPricingAgent, sampleNights, opts)).ok).toBe(true);
  });
  it("what-if: removing the event changes only that night", () => {
    const t = run(shortletPricingAgent, sampleNights, opts);
    const wi = whatIf(shortletPricingAgent, t, (o) => ({ ...o, localEvent: null }));
    expect(wi.diffs.map((d) => d.step)).toEqual([4]);
    expect(wi.diffs[0]!.after.ruleId).toBe("weekend");
  });
});
