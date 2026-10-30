/**
 * Tests for formatDiffCard – verifies agent-aware formatting of what-if diff
 * cards for haunted-npc, shortlet-pricing, and unknown agents.
 */
import { describe, it, expect } from "vitest";
import { formatDiffCard } from "../src/formatDiffCard.js";
import type { GhostDiff, Ghost } from "../src/types.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeGhost(overrides: Partial<Ghost> = {}): Ghost {
  return {
    step: 0,
    timeMs: 0,
    obs: {},
    stateBefore: {},
    ruleId: "fallback",
    reason: "test",
    action: {},
    stateAfter: {},
    prevHash: "0000",
    hash: "aaaa",
    ...overrides,
  };
}

function makeDiff(
  step: number,
  beforeRule: string,
  beforeAction: unknown,
  afterRule: string,
  afterAction: unknown,
): GhostDiff {
  return {
    step,
    before: { ruleId: beforeRule, action: beforeAction, reason: "before" },
    after: { ruleId: afterRule, action: afterAction, reason: "after" },
  };
}

// ── haunted-npc ───────────────────────────────────────────────────────────────

describe("formatDiffCard – haunted-npc", () => {
  const origAction = {
    dialogue: "I don't know your face.",
    moodAfter: "wary",
    trustChange: -5,
  };
  const altAction = {
    dialogue: "A lantern… the old flame-kind. Come in.",
    moodAfter: "warm",
    trustChange: 15,
  };
  const origGhost = makeGhost({ step: 1, action: origAction, obs: { beat: "inn-door" } });
  const altGhost = makeGhost({ step: 1, action: altAction, obs: { beat: "inn-door" } });
  const diff = makeDiff(1, "low-trust", origAction, "lantern-gift", altAction);

  it("builds a card with step index", () => {
    const card = formatDiffCard("haunted-npc", diff, origGhost, altGhost);
    expect(card.step).toBe(1);
  });

  it("title mentions both rule ids when rule changed", () => {
    const card = formatDiffCard("haunted-npc", diff, origGhost, altGhost);
    expect(card.title).toContain("low-trust");
    expect(card.title).toContain("lantern-gift");
  });

  it("includes Mood after field with original and scenario values", () => {
    const card = formatDiffCard("haunted-npc", diff, origGhost, altGhost);
    const moodField = card.fields.find((f) => f.label === "Mood after");
    expect(moodField).toBeDefined();
    expect(moodField!.original).toBe("wary");
    expect(moodField!.scenario).toBe("warm");
    expect(moodField!.changed).toBe(true);
  });

  it("includes Trust change field", () => {
    const card = formatDiffCard("haunted-npc", diff, origGhost, altGhost);
    const trustField = card.fields.find((f) => f.label === "Trust change");
    expect(trustField).toBeDefined();
    expect(trustField!.original).toBe("-5");
    expect(trustField!.scenario).toBe("15");
    expect(trustField!.changed).toBe(true);
  });

  it("includes Dialogue field", () => {
    const card = formatDiffCard("haunted-npc", diff, origGhost, altGhost);
    const dialogueField = card.fields.find((f) => f.label === "Dialogue");
    expect(dialogueField).toBeDefined();
    expect(dialogueField!.original).toContain("face");
    expect(dialogueField!.scenario).toContain("lantern");
    expect(dialogueField!.changed).toBe(true);
  });

  it("marks Rule field as changed when rule ids differ", () => {
    const card = formatDiffCard("haunted-npc", diff, origGhost, altGhost);
    const ruleField = card.fields.find((f) => f.label === "Rule");
    expect(ruleField!.changed).toBe(true);
  });

  it("marks unchanged fields as changed=false", () => {
    // Same rule, same moodAfter, only trustChange differs
    const sameRuleOrig = { ...origAction, moodAfter: "wary", trustChange: -5 };
    const sameRuleAlt = { ...origAction, moodAfter: "wary", trustChange: 10 };
    const d2 = makeDiff(0, "low-trust", sameRuleOrig, "low-trust", sameRuleAlt);
    const g1 = makeGhost({ action: sameRuleOrig });
    const g2 = makeGhost({ action: sameRuleAlt });
    const card = formatDiffCard("haunted-npc", d2, g1, g2);
    const ruleField = card.fields.find((f) => f.label === "Rule")!;
    expect(ruleField.changed).toBe(false);
    const moodField = card.fields.find((f) => f.label === "Mood after")!;
    expect(moodField.changed).toBe(false);
  });

  it("includes raw JSON for obs and action", () => {
    const card = formatDiffCard("haunted-npc", diff, origGhost, altGhost);
    expect(JSON.parse(card.rawOrigObs)).toEqual({ beat: "inn-door" });
    expect(JSON.parse(card.rawOrigAction)).toEqual(origAction);
    expect(JSON.parse(card.rawAltAction)).toEqual(altAction);
  });

  it("title stays informative when only action changed (same rule)", () => {
    const d2 = makeDiff(0, "low-trust", origAction, "low-trust", altAction);
    const card = formatDiffCard("haunted-npc", d2, origGhost, altGhost);
    expect(card.title).toContain("low-trust");
    // Should NOT say "Rule changed" when rules are the same
    expect(card.title).not.toContain("→");
  });
});

// ── shortlet-pricing ─────────────────────────────────────────────────────────

describe("formatDiffCard – shortlet-pricing", () => {
  const origAction = { date: "2026-12-01", price: 80, multiplier: 0.8 };
  const altAction = { date: "2026-12-01", price: 100, multiplier: 1.0 };
  const origGhost = makeGhost({ step: 0, action: origAction, obs: { daysUntil: 1 } });
  const altGhost = makeGhost({ step: 0, action: altAction, obs: { daysUntil: 10 } });
  const diff = makeDiff(0, "last-minute", origAction, "fallback", altAction);

  it("title mentions both rule ids", () => {
    const card = formatDiffCard("shortlet-pricing", diff, origGhost, altGhost);
    expect(card.title).toContain("last-minute");
    expect(card.title).toContain("fallback");
  });

  it("formats Price with $ prefix", () => {
    const card = formatDiffCard("shortlet-pricing", diff, origGhost, altGhost);
    const priceField = card.fields.find((f) => f.label === "Price");
    expect(priceField).toBeDefined();
    expect(priceField!.original).toBe("$80");
    expect(priceField!.scenario).toBe("$100");
    expect(priceField!.changed).toBe(true);
  });

  it("formats Multiplier with × prefix", () => {
    const card = formatDiffCard("shortlet-pricing", diff, origGhost, altGhost);
    const multField = card.fields.find((f) => f.label === "Multiplier");
    expect(multField).toBeDefined();
    expect(multField!.original).toBe("×0.8");
    expect(multField!.scenario).toBe("×1");
    expect(multField!.changed).toBe(true);
  });

  it("includes Date field", () => {
    const card = formatDiffCard("shortlet-pricing", diff, origGhost, altGhost);
    const dateField = card.fields.find((f) => f.label === "Date");
    expect(dateField!.original).toBe("2026-12-01");
    expect(dateField!.changed).toBe(false);
  });

  it("marks Price as unchanged=false when same price", () => {
    const same = { date: "2026-12-01", price: 100, multiplier: 1.0 };
    const d2 = makeDiff(0, "fallback", same, "fallback", same);
    const g1 = makeGhost({ action: same });
    const g2 = makeGhost({ action: same });
    const card = formatDiffCard("shortlet-pricing", d2, g1, g2);
    const priceField = card.fields.find((f) => f.label === "Price")!;
    expect(priceField.changed).toBe(false);
  });

  it("includes raw obs and action JSON", () => {
    const card = formatDiffCard("shortlet-pricing", diff, origGhost, altGhost);
    expect(JSON.parse(card.rawOrigObs)).toEqual({ daysUntil: 1 });
    expect(JSON.parse(card.rawAltObs)).toEqual({ daysUntil: 10 });
    expect(JSON.parse(card.rawOrigAction)).toEqual(origAction);
  });
});

// ── unknown / generic agent ───────────────────────────────────────────────────

describe("formatDiffCard – generic/unknown agent", () => {
  it("uses Action field for primitive action values", () => {
    const diff = makeDiff(0, "rule-a", "alert", "rule-b", "ignore");
    const g1 = makeGhost({ action: "alert" });
    const g2 = makeGhost({ action: "ignore" });
    const card = formatDiffCard("my-custom-agent", diff, g1, g2);
    const actionField = card.fields.find((f) => f.label === "Action");
    expect(actionField).toBeDefined();
    expect(actionField!.original).toBe("alert");
    expect(actionField!.scenario).toBe("ignore");
    expect(actionField!.changed).toBe(true);
  });

  it("uses object keys as field labels", () => {
    const origA = { status: "ok", score: 1 };
    const altA = { status: "warn", score: 5 };
    const diff = makeDiff(0, "rule-a", origA, "rule-b", altA);
    const g1 = makeGhost({ action: origA });
    const g2 = makeGhost({ action: altA });
    const card = formatDiffCard("unknown-agent", diff, g1, g2);
    const statusField = card.fields.find((f) => f.label === "status");
    expect(statusField!.original).toBe("ok");
    expect(statusField!.scenario).toBe("warn");
    expect(statusField!.changed).toBe(true);
    const scoreField = card.fields.find((f) => f.label === "score");
    expect(scoreField!.original).toBe("1");
    expect(scoreField!.scenario).toBe("5");
  });

  it("includes Rule field", () => {
    const diff = makeDiff(2, "r1", {}, "r2", {});
    const g1 = makeGhost({ step: 2 });
    const g2 = makeGhost({ step: 2 });
    const card = formatDiffCard("other", diff, g1, g2);
    const ruleField = card.fields.find((f) => f.label === "Rule");
    expect(ruleField!.original).toBe("r1");
    expect(ruleField!.scenario).toBe("r2");
  });

  it("provides raw JSON for obs and action", () => {
    const diff = makeDiff(0, "r1", { x: 1 }, "r2", { x: 2 });
    const g1 = makeGhost({ obs: { a: 1 }, action: { x: 1 } });
    const g2 = makeGhost({ obs: { a: 2 }, action: { x: 2 } });
    const card = formatDiffCard("any", diff, g1, g2);
    expect(JSON.parse(card.rawOrigObs)).toEqual({ a: 1 });
    expect(JSON.parse(card.rawAltObs)).toEqual({ a: 2 });
  });

  it("is pure – same inputs always produce same output", () => {
    const diff = makeDiff(0, "r1", { v: 1 }, "r2", { v: 2 });
    const g1 = makeGhost({ action: { v: 1 } });
    const g2 = makeGhost({ action: { v: 2 } });
    const a = formatDiffCard("any", diff, g1, g2);
    const b = formatDiffCard("any", diff, g1, g2);
    expect(a).toEqual(b);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("formatDiffCard – edge cases", () => {
  it("handles null action gracefully", () => {
    const diff = makeDiff(0, "r1", null, "r2", null);
    const g1 = makeGhost({ action: null });
    const g2 = makeGhost({ action: null });
    expect(() => formatDiffCard("haunted-npc", diff, g1, g2)).not.toThrow();
  });

  it("handles missing optional NPC fields", () => {
    const origA = { dialogue: "Hello" };
    const altA = { dialogue: "Goodbye", moodAfter: "hostile" };
    const diff = makeDiff(0, "r1", origA, "r1", altA);
    const g1 = makeGhost({ action: origA });
    const g2 = makeGhost({ action: altA });
    const card = formatDiffCard("haunted-npc", diff, g1, g2);
    const moodField = card.fields.find((f) => f.label === "Mood after");
    expect(moodField!.original).toBe("—");
    expect(moodField!.scenario).toBe("hostile");
    expect(moodField!.changed).toBe(true);
  });

  it("handles missing optional shortlet fields", () => {
    const origA = { price: 100 };
    const altA = { price: 120, multiplier: 1.2 };
    const diff = makeDiff(0, "r1", origA, "r1", altA);
    const g1 = makeGhost({ action: origA });
    const g2 = makeGhost({ action: altA });
    const card = formatDiffCard("shortlet-pricing", diff, g1, g2);
    const multField = card.fields.find((f) => f.label === "Multiplier");
    expect(multField!.original).toBe("—");
    expect(multField!.scenario).toBe("×1.2");
  });
});
