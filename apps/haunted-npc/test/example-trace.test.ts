import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { replay, verifyChain, type Trace } from "../../../packages/core/src/index.js";
import { hauntedNpcAgent, type EncounterObs, type NpcAction, type NpcState } from "../src/agent.js";

type NpcTrace = Trace<NpcState, EncounterObs, NpcAction>;

function load(rel: string): NpcTrace {
  const raw = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
  const file = JSON.parse(raw) as { schemaVersion: number; trace: NpcTrace };
  expect(file.schemaVersion).toBe(1);
  return file.trace;
}

// If these fail, regenerate: `node dist/apps/haunted-npc/src/generate-trace.js` (after `npm run build`),
// then copy apps/haunted-npc/src/example-trace-npc.json to viewer/src/example-trace-npc.json.
describe("bundled NPC example traces", () => {
  for (const [label, rel] of [
    ["apps/haunted-npc/src/example-trace-npc.json", "../src/example-trace-npc.json"],
    ["viewer/src/example-trace-npc.json", "../../../viewer/src/example-trace-npc.json"],
  ] as const) {
    it(`${label}: chain verifies and replays with the current agent code`, () => {
      const trace = load(rel);
      expect(trace.agent).toBe(hauntedNpcAgent.name);
      expect(verifyChain(trace).ok).toBe(true);
      expect(replay(hauntedNpcAgent, trace).ok).toBe(true);
    });
  }

  it("viewer copy matches the app copy", () => {
    expect(load("../../../viewer/src/example-trace-npc.json")).toEqual(load("../src/example-trace-npc.json"));
  });
});
