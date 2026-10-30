import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { replay, run, whatIf } from "../../../packages/core/src/index.js";
import { hauntedNpcAgent, type EncounterObs, type NpcState } from "../src/agent.js";
import { encounterScript } from "../src/script.js";

const BASE_OPTS = { seed: 13, startMs: 0, stepMs: 60_000 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function obs(overrides: Partial<EncounterObs>): EncounterObs {
  return {
    beat: "test",
    playerTrust: 50,
    hasLantern: false,
    hasRelicKey: false,
    hourOfNight: 12,
    ...overrides,
  };
}

function runSingle(o: EncounterObs, initialMood: NpcState["mood"] = "neutral") {
  const agent = {
    ...hauntedNpcAgent,
    initialState: { ...hauntedNpcAgent.initialState, mood: initialMood },
  };
  return run(agent, [o], BASE_OPTS).ghosts[0]!;
}

// ── Rule selection tests ──────────────────────────────────────────────────────

describe("haunted-npc rule selection", () => {
  it("betray: fires when player holds relic key and trust < 20", () => {
    const g = runSingle(obs({ hasRelicKey: true, playerTrust: 10 }));
    expect(g.ruleId).toBe("betray");
    expect(g.action.moodAfter).toBe("hostile");
    expect(g.action.trustChange).toBe(-30);
  });

  it("betray: does NOT fire when trust >= 20 even with relic key", () => {
    const g = runSingle(obs({ hasRelicKey: true, playerTrust: 20 }));
    expect(g.ruleId).not.toBe("betray");
  });

  it("lantern-gift: fires when player offers lantern in wary mood", () => {
    const g = runSingle(
      obs({ hasLantern: true, playerAction: "offer-lantern", playerTrust: 50 }),
      "wary",
    );
    expect(g.ruleId).toBe("lantern-gift");
    expect(g.action.moodAfter).toBe("warm");
    expect(g.action.trustChange).toBe(15);
  });

  it("lantern-gift: fires when player offers lantern in neutral mood", () => {
    const g = runSingle(
      obs({ hasLantern: true, playerAction: "offer-lantern", playerTrust: 50 }),
      "neutral",
    );
    expect(g.ruleId).toBe("lantern-gift");
  });

  it("lantern-gift: does NOT fire without lantern", () => {
    const g = runSingle(
      obs({ hasLantern: false, playerAction: "offer-lantern", playerTrust: 50 }),
      "wary",
    );
    expect(g.ruleId).not.toBe("lantern-gift");
  });

  it("midnight-dread: fires at hour 0–3 when mood is not haunted", () => {
    for (const hour of [0, 1, 2, 3]) {
      const g = runSingle(obs({ hourOfNight: hour, playerTrust: 50 }), "neutral");
      expect(g.ruleId).toBe("midnight-dread");
      expect(g.action.moodAfter).toBe("haunted");
    }
  });

  it("midnight-dread: does NOT fire when mood is already haunted", () => {
    const g = runSingle(obs({ hourOfNight: 1 }), "haunted");
    expect(g.ruleId).not.toBe("midnight-dread");
  });

  it("midnight-dread: does NOT fire at hour 4", () => {
    const g = runSingle(obs({ hourOfNight: 4 }), "neutral");
    expect(g.ruleId).not.toBe("midnight-dread");
  });

  it("high-trust: fires when trust >= 70", () => {
    const g = runSingle(obs({ playerTrust: 70, hourOfNight: 12 }), "neutral");
    expect(g.ruleId).toBe("high-trust");
    expect(g.action.moodAfter).toBe("warm");
    expect(g.action.trustChange).toBe(5);
  });

  it("low-trust: fires when trust <= 20 and mood is not hostile", () => {
    const g = runSingle(obs({ playerTrust: 20, hourOfNight: 12 }), "neutral");
    expect(g.ruleId).toBe("low-trust");
    expect(g.action.moodAfter).toBe("wary");
  });

  it("low-trust: does NOT fire when mood is hostile", () => {
    const g = runSingle(obs({ playerTrust: 20, hourOfNight: 12 }), "hostile");
    expect(g.ruleId).not.toBe("low-trust");
  });

  it("fallback: fires when no other rule matches", () => {
    // trust=45, hour=12, no lantern, no relic key, neutral mood
    const g = runSingle(obs({ playerTrust: 45, hourOfNight: 12 }), "haunted");
    expect(g.ruleId).toBe("fallback");
    // fallback dialogue is one of the known lines
    expect(g.action.dialogue.length).toBeGreaterThan(0);
    // mood unchanged in fallback
    expect(g.action.moodAfter).toBe("haunted");
  });

  it("rule priority: betray before low-trust (relic key + trust<=20)", () => {
    const g = runSingle(obs({ hasRelicKey: true, playerTrust: 10 }), "neutral");
    expect(g.ruleId).toBe("betray");
  });

  it("example script fires all 6 expected rules in order", () => {
    const trace = run(hauntedNpcAgent, encounterScript, BASE_OPTS);
    expect(trace.ghosts.map((g) => g.ruleId)).toEqual([
      "low-trust",
      "lantern-gift",
      "midnight-dread",
      "fallback",
      "high-trust",
      "betray",
    ]);
  });
});

// ── Replay round-trip ─────────────────────────────────────────────────────────

describe("replay", () => {
  it("round-trip: replay of the example script passes", () => {
    const trace = run(hauntedNpcAgent, encounterScript, BASE_OPTS);
    expect(replay(hauntedNpcAgent, trace).ok).toBe(true);
  });

  it("replay fails when a ghost is tampered with", () => {
    const trace = run(hauntedNpcAgent, encounterScript, BASE_OPTS);
    // Clone and corrupt the first ghost's hash
    const tampered = {
      ...trace,
      ghosts: trace.ghosts.map((g, i) =>
        i === 0 ? { ...g, hash: "a".repeat(64) } : g,
      ),
      headHash: "a".repeat(64),
    };
    expect(replay(hauntedNpcAgent, tampered).ok).toBe(false);
  });
});

// ── Identity what-if (no-op patch) ───────────────────────────────────────────

describe("whatIf identity", () => {
  it("identity patch produces zero diffs", () => {
    const trace = run(hauntedNpcAgent, encounterScript, BASE_OPTS);
    const wi = whatIf(hauntedNpcAgent, trace, (o) => o);
    expect(wi.diffs).toHaveLength(0);
  });
});

// ── Lantern what-if ───────────────────────────────────────────────────────────

describe("whatIf lantern at beat 0", () => {
  it("patching beat 0 to offer lantern changes at least 1 decision", () => {
    const trace = run(hauntedNpcAgent, encounterScript, BASE_OPTS);
    const wi = whatIf(hauntedNpcAgent, trace, (o, step) => {
      if (step === 0) return { ...o, hasLantern: true, playerAction: "offer-lantern" as const };
      return o;
    });
    // Beat 0 was low-trust; with lantern+neutral mood it should switch to lantern-gift
    // (but mood is neutral at beat 0, so lantern-gift fires — but low-trust fires first
    //  because trust=15<=20; let's verify it changes at all)
    expect(wi.diffs.length).toBeGreaterThan(0);
  });

  it("patching lantern=true on beat 1 (already offer-lantern) is identity", () => {
    const trace = run(hauntedNpcAgent, encounterScript, BASE_OPTS);
    // Beat 1 already has hasLantern=true and playerAction=offer-lantern
    const wi = whatIf(hauntedNpcAgent, trace, (o, step) => {
      if (step === 1) return { ...o, hasLantern: true, playerAction: "offer-lantern" as const };
      return o;
    });
    // Step 1 already uses lantern-gift, so no diff expected for that step
    const step1Diff = wi.diffs.find((d) => d.step === 1);
    expect(step1Diff).toBeUndefined();
  });
});

// ── Property tests ────────────────────────────────────────────────────────────

describe("property: same seed + same obs => same headHash", () => {
  it("determinism holds across random observation sequences", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),
        fc.array(
          fc.record({
            beat: fc.constantFrom("inn-door", "corridor", "vault-door", "taproom"),
            playerTrust: fc.integer({ min: 0, max: 100 }),
            hasLantern: fc.boolean(),
            hasRelicKey: fc.boolean(),
            hourOfNight: fc.integer({ min: 0, max: 23 }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        (seed, observations) => {
          const opts = { seed, startMs: 0, stepMs: 1000 };
          const t1 = run(hauntedNpcAgent, observations, opts);
          const t2 = run(hauntedNpcAgent, observations, opts);
          return t1.headHash === t2.headHash;
        },
      ),
    );
  });
});
