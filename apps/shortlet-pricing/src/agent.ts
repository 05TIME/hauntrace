import type { AgentDefinition, Rule } from "../../../packages/core/src/index.js";

/** One night to price. All figures are EXAMPLE data, not market data. */
export interface NightObs {
  date: string; // YYYY-MM-DD
  daysUntil: number;
  isWeekend: boolean;
  areaOccupancyPct: number; // 0-100
  localEvent: string | null;
}

export interface PricingState {
  basePrice: number; // per night, in whole currency units
  floorPrice: number;
  ceilingPrice: number;
  nightsPriced: number;
}

export interface PriceAction {
  date: string;
  price: number;
  multiplier: number;
}

const clamp = (s: PricingState, p: number) => Math.round(Math.min(s.ceilingPrice, Math.max(s.floorPrice, p)));

function priced(state: PricingState, obs: NightObs, multiplier: number): PriceAction {
  return { date: obs.date, price: clamp(state, state.basePrice * multiplier), multiplier };
}

const rules: Rule<PricingState, NightObs, PriceAction>[] = [
  {
    id: "event-surge",
    description: "A local event raises the price by 35%",
    evaluate: ({ state, obs }) =>
      obs.localEvent ? { action: priced(state, obs, 1.35), reason: `Event nearby: ${obs.localEvent} (+35%)` } : null,
  },
  {
    id: "last-minute",
    description: "Within 2 days and area occupancy under 60%: discount 20%",
    evaluate: ({ state, obs }) =>
      obs.daysUntil <= 2 && obs.areaOccupancyPct < 60
        ? { action: priced(state, obs, 0.8), reason: `Last minute (${obs.daysUntil}d) with ${obs.areaOccupancyPct}% occupancy (-20%)` }
        : null,
  },
  {
    id: "high-demand",
    description: "Area occupancy at or above 85%: +20%",
    evaluate: ({ state, obs }) =>
      obs.areaOccupancyPct >= 85
        ? { action: priced(state, obs, 1.2), reason: `High demand: ${obs.areaOccupancyPct}% occupancy (+20%)` }
        : null,
  },
  {
    id: "weekend",
    description: "Friday/Saturday night: +10%",
    evaluate: ({ state, obs }) => (obs.isWeekend ? { action: priced(state, obs, 1.1), reason: "Weekend night (+10%)" } : null),
  },
];

export const shortletPricingAgent: AgentDefinition<PricingState, NightObs, PriceAction> = {
  name: "shortlet-pricing",
  version: "0.1.0",
  initialState: { basePrice: 100, floorPrice: 60, ceilingPrice: 200, nightsPriced: 0 },
  rules,
  fallback: ({ state, obs, rng }) => {
    // Small seeded exploration so runs differ by seed but replay exactly.
    const m = Math.round((0.98 + rng.next() * 0.04) * 1000) / 1000;
    return { action: priced(state, obs, m), reason: `No rule fired: base price with seeded nudge x${m}` };
  },
  reduce: (s) => ({ ...s, nightsPriced: s.nightsPriced + 1 }),
};
