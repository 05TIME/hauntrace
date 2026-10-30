import { replay, run, whatIf } from "../../../packages/core/src/index.js";
import { shortletPricingAgent } from "./agent.js";
import { sampleNights } from "./sample.js";

const opts = { seed: 31, startMs: Date.UTC(2026, 10, 30), stepMs: 60_000 };
const trace = run(shortletPricingAgent, sampleNights, opts);
console.log("Ghosts (EXAMPLE data):");
for (const g of trace.ghosts) console.log(`  ${g.action.date}  ${g.action.price}  [${g.ruleId}] ${g.reason}`);
console.log(`head ${trace.headHash}`);
console.log(`replay: ${replay(shortletPricingAgent, trace).ok ? "verified" : "DIVERGED"}`);
const wi = whatIf(shortletPricingAgent, trace, (o) => ({ ...o, areaOccupancyPct: Math.min(100, o.areaOccupancyPct + 20) }));
console.log(`what-if occupancy +20pts: ${wi.diffs.length} decision(s) changed`);
for (const d of wi.diffs) console.log(`  step ${d.step}: ${d.before.ruleId} ${d.before.action.price} -> ${d.after.ruleId} ${d.after.action.price}`);
