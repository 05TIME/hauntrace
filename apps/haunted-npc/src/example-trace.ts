import { run, type Trace } from "../../../packages/core/src/index.js";
import { hauntedNpcAgent, type EncounterObs, type NpcAction, type NpcState } from "./agent.js";
import { encounterScript } from "./script.js";

/** Run options for the bundled EXAMPLE trace. */
export const npcExampleOptions = { seed: 13, startMs: Date.UTC(2026, 9, 31), stepMs: 60_000 } as const;

export interface NpcTraceFile {
  schemaVersion: 1;
  trace: Trace<NpcState, EncounterObs, NpcAction>;
}

/** Pure and deterministic: builds the bundled NPC example file (EXAMPLE data only). */
export function buildNpcExampleFile(): NpcTraceFile {
  return { schemaVersion: 1, trace: run(hauntedNpcAgent, encounterScript, { ...npcExampleOptions }) };
}
