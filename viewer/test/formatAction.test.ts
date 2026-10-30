import { describe, it, expect } from "vitest";
import { formatAction } from "../src/formatAction.js";

describe("formatAction", () => {
  // ── Primitives ──────────────────────────────────────────────
  it("returns the number as a string for numeric actions (shortlet)", () => {
    expect(formatAction(120)).toBe("120");
    expect(formatAction(0)).toBe("0");
    expect(formatAction(-5)).toBe("-5");
  });

  it("returns the string as-is when ≤24 chars", () => {
    expect(formatAction("hello")).toBe("hello");
  });

  it("truncates a plain string longer than 24 chars with ellipsis", () => {
    const long = "abcdefghijklmnopqrstuvwxyz"; // 26 chars
    const result = formatAction(long);
    expect(result.length).toBe(24);
    expect(result.endsWith("…")).toBe(true);
  });

  it("returns '—' for null", () => {
    expect(formatAction(null)).toBe("—");
  });

  it("returns '—' for undefined", () => {
    expect(formatAction(undefined)).toBe("—");
  });

  // ── Shortlet-style objects (price field) ────────────────────
  it("formats shortlet action with numeric price as '$<price>'", () => {
    expect(formatAction({ price: 150, date: "2024-11-01" })).toBe("$150");
  });

  it("formats shortlet action with price=0", () => {
    expect(formatAction({ price: 0 })).toBe("$0");
  });

  // ── NPC-style objects (moodAfter / mood field) ──────────────
  it("uses moodAfter for NPC actions", () => {
    expect(
      formatAction({
        dialogue: "I don't know your face.",
        moodAfter: "wary",
        trustChange: -5,
      }),
    ).toBe("wary");
  });

  it("uses mood field when moodAfter is absent", () => {
    expect(formatAction({ mood: "haunted", score: 3 })).toBe("haunted");
  });

  it("truncates a long moodAfter value", () => {
    const result = formatAction({ moodAfter: "a".repeat(30) });
    expect(result.length).toBe(24);
    expect(result.endsWith("…")).toBe(true);
  });

  // ── Generic object fallback ──────────────────────────────────
  it("picks first string-valued field when no known key is present", () => {
    expect(formatAction({ label: "patrol", count: 3 })).toBe("patrol");
  });

  it("returns '[object]' when object has no string fields", () => {
    expect(formatAction({ x: 1, y: 2 })).toBe("[object]");
  });

  it("returns '[object]' for an empty object", () => {
    expect(formatAction({})).toBe("[object]");
  });

  // ── Determinism ──────────────────────────────────────────────
  it("is pure: same input always returns same output", () => {
    const action = { moodAfter: "warm", trustChange: 15 };
    expect(formatAction(action)).toBe(formatAction(action));
  });

  // ── Max-length guarantee ─────────────────────────────────────
  it("never returns a string longer than 24 chars", () => {
    const inputs: unknown[] = [
      "a".repeat(100),
      { moodAfter: "b".repeat(50) },
      { dialogue: "c".repeat(50), moodAfter: "neutral" },
      { label: "d".repeat(50) },
    ];
    for (const input of inputs) {
      expect(formatAction(input).length).toBeLessThanOrEqual(24);
    }
  });
});
