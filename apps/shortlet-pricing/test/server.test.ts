import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run, replay, type Trace } from "../../../packages/core/src/index.js";
import { shortletPricingAgent, type NightObs, type PricingState, type PriceAction } from "../src/agent.js";
import { sampleNights } from "../src/sample.js";
import { createShortletServer } from "../src/server.js";

// ---------------------------------------------------------------------------
// Test server — loopback + ephemeral port only
// ---------------------------------------------------------------------------

let baseUrl: string;
let server: ReturnType<typeof createShortletServer>;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = createShortletServer();
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
);

async function postRun(body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${baseUrl}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

const validOptions = { seed: 31, startMs: 0, stepMs: 1000 };

// ---------------------------------------------------------------------------
// Happy path — shortlet pricing
// ---------------------------------------------------------------------------

describe("shortlet pricing server — POST /run", () => {
  it("returns 200 with trace and replayResult.ok=true for sample nights", async () => {
    const { status, json } = await postRun({ observations: sampleNights, options: validOptions });
    expect(status).toBe(200);
    const body = json as { trace: Trace<PricingState, NightObs, PriceAction>; replayResult: { ok: boolean } };
    expect(body.replayResult.ok).toBe(true);
    expect(body.trace.ghosts).toHaveLength(sampleNights.length);
  });

  it("fired rules match the expected pattern for sample nights", async () => {
    const { json } = await postRun({ observations: sampleNights, options: validOptions });
    const body = json as { trace: Trace<PricingState, NightObs, PriceAction> };
    expect(body.trace.ghosts.map((g) => g.ruleId)).toEqual([
      "last-minute",
      "fallback",
      "weekend",
      "high-demand",
      "event-surge",
    ]);
  });

  it("headHash matches a direct run", async () => {
    const { json } = await postRun({ observations: sampleNights, options: validOptions });
    const body = json as { trace: Trace<PricingState, NightObs, PriceAction> };
    const direct = run(shortletPricingAgent, sampleNights, validOptions);
    expect(body.trace.headHash).toBe(direct.headHash);
  });

  it("returned trace passes replay directly", async () => {
    const { json } = await postRun({ observations: sampleNights, options: validOptions });
    const body = json as { trace: Trace<PricingState, NightObs, PriceAction> };
    expect(replay(shortletPricingAgent, body.trace).ok).toBe(true);
  });

  it("what-if: zeroing localEvent changes only the event-surge night", async () => {
    const { status, json } = await postRun({
      observations: sampleNights,
      options: validOptions,
      whatIfPatch: { localEvent: null },
    });
    expect(status).toBe(200);
    const body = json as {
      whatIfResult: { diffs: Array<{ step: number; before: { ruleId: string }; after: { ruleId: string } }> };
    };
    expect(body.whatIfResult.diffs).toHaveLength(1);
    expect(body.whatIfResult.diffs[0]!.step).toBe(4); // "Year-end concert" night
    expect(body.whatIfResult.diffs[0]!.before.ruleId).toBe("event-surge");
    expect(body.whatIfResult.diffs[0]!.after.ruleId).toBe("weekend");
  });

  it("what-if: high-occupancy patch triggers high-demand on previously-quiet nights", async () => {
    const { json } = await postRun({
      observations: sampleNights,
      options: validOptions,
      whatIfPatch: { areaOccupancyPct: 90 },
    });
    const body = json as {
      whatIfResult: { diffs: Array<{ step: number }> };
    };
    // nights 0, 1, 2 had occupancy < 85 (48, 70, 72) so they should now differ
    expect(body.whatIfResult.diffs.length).toBeGreaterThan(0);
  });

  it("prices stay within floor and ceiling in the response trace", async () => {
    const { json } = await postRun({ observations: sampleNights, options: validOptions });
    const body = json as { trace: Trace<PricingState, NightObs, PriceAction> };
    for (const g of body.trace.ghosts) {
      expect(g.action.price).toBeGreaterThanOrEqual(60);
      expect(g.action.price).toBeLessThanOrEqual(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Validation — 400 errors (shortlet-specific observations)
// ---------------------------------------------------------------------------

describe("shortlet pricing server — validation errors", () => {
  it("returns 400 when observations is missing", async () => {
    const { status, json } = await postRun({ options: validOptions });
    expect(status).toBe(400);
    const body = json as { details: string[] };
    expect(body.details.some((d) => d.includes("observations"))).toBe(true);
  });

  it("returns 400 when options.stepMs is not a number", async () => {
    const { status, json } = await postRun({
      observations: sampleNights,
      options: { seed: 1, startMs: 0, stepMs: "fast" },
    });
    expect(status).toBe(400);
    const body = json as { details: string[] };
    expect(body.details.some((d) => d.includes("stepMs"))).toBe(true);
  });
});
