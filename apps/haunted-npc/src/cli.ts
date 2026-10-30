import { replay, run, whatIf } from "../../../packages/core/src/index.js";
import { hauntedNpcAgent } from "./agent.js";
import { encounterScript } from "./script.js";

const opts = { seed: 13, startMs: Date.UTC(2026, 9, 31), stepMs: 60_000 };
const trace = run(hauntedNpcAgent, encounterScript, opts);

console.log("=== Haunted Inn NPC — EXAMPLE trace ===\n");
for (const g of trace.ghosts) {
  console.log(
    `  [${g.step}] ${g.obs.beat}  rule=${g.ruleId}  mood=${g.action.moodAfter}  trust±${g.action.trustChange}`,
  );
  console.log(`       "${g.action.dialogue}"`);
  console.log(`       reason: ${g.reason}\n`);
}
console.log(`head  ${trace.headHash}`);
console.log(`replay: ${replay(hauntedNpcAgent, trace).ok ? "✅ verified" : "❌ DIVERGED"}\n`);

// What-if: what if the player had brought the lantern from beat 0?
// Patch every beat where hasLantern=false to hasLantern=true and playerAction='offer-lantern'.
const wi = whatIf(hauntedNpcAgent, trace, (obs, step) => {
  if (!obs.hasLantern && step === 0) {
    return { ...obs, hasLantern: true, playerAction: "offer-lantern" };
  }
  return obs;
});
console.log(`what-if (lantern at beat 0): ${wi.diffs.length} decision(s) changed`);
for (const d of wi.diffs) {
  console.log(
    `  step ${d.step}: [${d.before.ruleId}] → [${d.after.ruleId}]  reason: ${d.after.reason}`,
  );
}
