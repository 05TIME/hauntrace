import { describe, it, expect } from "vitest";
import { explainRun, explainText } from "../src/explainRun.js";
import { verifyChain } from "../src/verifyChain.js";
import exampleRaw from "../src/example-trace.json";
import exampleNpcRaw from "../src/example-trace-npc.json";
import type { TraceFile } from "../src/types.js";

const examples: Array<[string, TraceFile]> = [
  ["shortlet", exampleRaw as unknown as TraceFile],
  ["npc", exampleNpcRaw as unknown as TraceFile],
];

describe("explainRun (viewer)", () => {
  for (const [name, file] of examples) {
    it(`${name}: deterministic, mentions every step and rule id`, async () => {
      const verify = await verifyChain(file.trace);
      const a = explainText(explainRun(file.trace, verify));
      const b = explainText(explainRun(structuredClone(file.trace), { ...verify }));
      expect(a).toBe(b);

      const story = explainRun(file.trace, verify);
      expect(story.steps).toHaveLength(file.trace.ghosts.length);
      file.trace.ghosts.forEach((g, i) => {
        expect(story.steps[i]).toContain(`Step ${i + 1} `);
        if (g.ruleId === "fallback") expect(story.steps[i]).toContain("fallback");
        else expect(story.steps[i]).toContain(`"${g.ruleId}"`);
        expect(story.steps[i]).toContain(g.reason);
      });
    });

    it(`${name}: verified chain is reported as verifying`, async () => {
      const verify = await verifyChain(file.trace);
      const story = explainRun(file.trace, verify);
      if (verify.ok) expect(story.closing).toContain("verifies");
      else expect(story.closing).toContain("BROKEN");
    });

    it(`${name}: tampered trace says the chain is broken`, async () => {
      const t = structuredClone(file.trace);
      t.ghosts[0]!.reason = "edited after the fact";
      const verify = await verifyChain(t);
      expect(verify.ok).toBe(false);
      const story = explainRun(t, verify);
      expect(story.closing).toContain("BROKEN");
      expect(story.closing).toContain("step 1");
      expect(story.closing).not.toContain("verifies");
    });
  }

  it("handles an empty trace", () => {
    const t = { ...examples[0]![1].trace, ghosts: [] };
    const story = explainRun(t, { ok: true });
    expect(story.steps).toEqual([]);
    expect(story.intro).toContain("0 steps");
  });
});
