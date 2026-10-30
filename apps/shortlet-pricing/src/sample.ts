import type { NightObs } from "./agent.js";

/** EXAMPLE nights for the demo. Not real occupancy data. */
export const sampleNights: NightObs[] = [
  { date: "2026-12-01", daysUntil: 1, isWeekend: false, areaOccupancyPct: 48, localEvent: null },
  { date: "2026-12-02", daysUntil: 2, isWeekend: false, areaOccupancyPct: 70, localEvent: null },
  { date: "2026-12-04", daysUntil: 4, isWeekend: true, areaOccupancyPct: 72, localEvent: null },
  { date: "2026-12-05", daysUntil: 5, isWeekend: true, areaOccupancyPct: 90, localEvent: null },
  { date: "2026-12-12", daysUntil: 12, isWeekend: true, areaOccupancyPct: 80, localEvent: "Year-end concert" },
];
