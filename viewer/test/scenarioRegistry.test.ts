/**
 * Tests for scenarioRegistry.ts
 * Covers: getScenariosForAgent, hasScenarios, and every patchObs function.
 */
import { describe, it, expect } from "vitest";
import { getScenariosForAgent, hasScenarios } from "../src/scenarioRegistry.js";

// ── Registry lookup ────────────────────────────────────────────────────────────

describe("hasScenarios", () => {
  it("returns true for shortlet-pricing", () => {
    expect(hasScenarios("shortlet-pricing")).toBe(true);
  });

  it("returns true for haunted-npc", () => {
    expect(hasScenarios("haunted-npc")).toBe(true);
  });

  it("returns false for unknown agents", () => {
    expect(hasScenarios("some-unknown-agent")).toBe(false);
    expect(hasScenarios("")).toBe(false);
  });
});

describe("getScenariosForAgent", () => {
  it("returns empty array for unknown agents", () => {
    expect(getScenariosForAgent("unknown")).toEqual([]);
  });

  it("returns 4 scenarios for shortlet-pricing", () => {
    const scenarios = getScenariosForAgent("shortlet-pricing");
    expect(scenarios).toHaveLength(4);
  });

  it("returns 5 scenarios for haunted-npc", () => {
    const scenarios = getScenariosForAgent("haunted-npc");
    expect(scenarios).toHaveLength(5);
  });

  it("all shortlet scenario ids are unique", () => {
    const ids = getScenariosForAgent("shortlet-pricing").map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all npc scenario ids are unique", () => {
    const ids = getScenariosForAgent("haunted-npc").map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every scenario has a non-empty label", () => {
    for (const agentId of ["shortlet-pricing", "haunted-npc"]) {
      for (const s of getScenariosForAgent(agentId)) {
        expect(s.label.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── Shortlet scenarios ─────────────────────────────────────────────────────────

describe("shortlet-pricing scenarios", () => {
  const shortlet = getScenariosForAgent("shortlet-pricing");
  const byId = (id: string) => shortlet.find((s) => s.id === id)!;

  describe("occupancy+20", () => {
    const sc = byId("occupancy+20");

    it("raises areaOccupancyPct by 20", () => {
      const result = sc.patchObs({ areaOccupancyPct: 50 });
      expect(result["areaOccupancyPct"]).toBe(70);
    });

    it("clamps at 100", () => {
      const result = sc.patchObs({ areaOccupancyPct: 90 });
      expect(result["areaOccupancyPct"]).toBe(100);
    });

    it("handles missing field (treats as 0)", () => {
      const result = sc.patchObs({});
      expect(result["areaOccupancyPct"]).toBe(20);
    });

    it("preserves other fields", () => {
      const result = sc.patchObs({ areaOccupancyPct: 50, isWeekend: true, localEvent: "fest" });
      expect(result["isWeekend"]).toBe(true);
      expect(result["localEvent"]).toBe("fest");
    });
  });

  describe("occupancy-20", () => {
    const sc = byId("occupancy-20");

    it("lowers areaOccupancyPct by 20", () => {
      const result = sc.patchObs({ areaOccupancyPct: 50 });
      expect(result["areaOccupancyPct"]).toBe(30);
    });

    it("clamps at 0", () => {
      const result = sc.patchObs({ areaOccupancyPct: 10 });
      expect(result["areaOccupancyPct"]).toBe(0);
    });
  });

  describe("no-events", () => {
    const sc = byId("no-events");

    it("sets localEvent to null", () => {
      const result = sc.patchObs({ localEvent: "Concert", areaOccupancyPct: 80 });
      expect(result["localEvent"]).toBeNull();
    });

    it("is idempotent on already-null event", () => {
      const result = sc.patchObs({ localEvent: null });
      expect(result["localEvent"]).toBeNull();
    });
  });

  describe("all-weekend", () => {
    const sc = byId("all-weekend");

    it("sets isWeekend to true", () => {
      const result = sc.patchObs({ isWeekend: false, areaOccupancyPct: 60 });
      expect(result["isWeekend"]).toBe(true);
    });

    it("is idempotent when already weekend", () => {
      const result = sc.patchObs({ isWeekend: true });
      expect(result["isWeekend"]).toBe(true);
    });
  });
});

// ── NPC scenarios ──────────────────────────────────────────────────────────────

describe("haunted-npc scenarios", () => {
  const npc = getScenariosForAgent("haunted-npc");
  const byId = (id: string) => npc.find((s) => s.id === id)!;

  describe("npc-has-lantern", () => {
    const sc = byId("npc-has-lantern");

    it("sets hasLantern to true", () => {
      const result = sc.patchObs({ hasLantern: false, playerTrust: 20 });
      expect(result["hasLantern"]).toBe(true);
    });

    it("sets playerAction to offer-lantern when not present", () => {
      const result = sc.patchObs({ hasLantern: false });
      expect(result["playerAction"]).toBe("offer-lantern");
    });

    it("preserves existing playerAction if set", () => {
      const result = sc.patchObs({ hasLantern: false, playerAction: "inspect-room" });
      expect(result["playerAction"]).toBe("inspect-room");
    });

    it("preserves other fields", () => {
      const result = sc.patchObs({ hasLantern: false, playerTrust: 55, hasRelicKey: false });
      expect(result["playerTrust"]).toBe(55);
      expect(result["hasRelicKey"]).toBe(false);
    });
  });

  describe("npc-has-relic-key", () => {
    const sc = byId("npc-has-relic-key");

    it("sets hasRelicKey to true", () => {
      const result = sc.patchObs({ hasRelicKey: false, playerTrust: 30 });
      expect(result["hasRelicKey"]).toBe(true);
    });

    it("preserves other fields", () => {
      const result = sc.patchObs({ hasRelicKey: false, hasLantern: true, hourOfNight: 22 });
      expect(result["hasLantern"]).toBe(true);
      expect(result["hourOfNight"]).toBe(22);
    });

    it("with low trust this obs would trigger betray rule", () => {
      // Smoke test: trust 15 < 20 + hasRelicKey: true → betray rule fires
      const result = sc.patchObs({ hasRelicKey: false, playerTrust: 15 });
      expect(result["hasRelicKey"]).toBe(true);
      expect(result["playerTrust"]).toBe(15); // trust unchanged
    });
  });

  describe("npc-trust-high", () => {
    const sc = byId("npc-trust-high");

    it("raises playerTrust by 40", () => {
      const result = sc.patchObs({ playerTrust: 30 });
      expect(result["playerTrust"]).toBe(70);
    });

    it("clamps at 100", () => {
      const result = sc.patchObs({ playerTrust: 80 });
      expect(result["playerTrust"]).toBe(100);
    });

    it("handles missing field (treats as 0)", () => {
      const result = sc.patchObs({});
      expect(result["playerTrust"]).toBe(40);
    });

    it("low trust step reaches >= 70 threshold (high-trust rule territory)", () => {
      // trust 30 + 40 = 70 → exactly hits high-trust rule
      const result = sc.patchObs({ playerTrust: 30 });
      expect((result["playerTrust"] as number) >= 70).toBe(true);
    });
  });

  describe("npc-trust-low", () => {
    const sc = byId("npc-trust-low");

    it("lowers playerTrust by 40", () => {
      const result = sc.patchObs({ playerTrust: 60 });
      expect(result["playerTrust"]).toBe(20);
    });

    it("clamps at 0", () => {
      const result = sc.patchObs({ playerTrust: 10 });
      expect(result["playerTrust"]).toBe(0);
    });

    it("high trust step can fall into low-trust rule territory (<= 20)", () => {
      const result = sc.patchObs({ playerTrust: 55 });
      expect((result["playerTrust"] as number) <= 20).toBe(true);
    });
  });

  describe("npc-later-hour", () => {
    const sc = byId("npc-later-hour");

    it("adds 4 hours to hourOfNight", () => {
      const result = sc.patchObs({ hourOfNight: 18 });
      expect(result["hourOfNight"]).toBe(22);
    });

    it("wraps around midnight with modulo 24", () => {
      const result = sc.patchObs({ hourOfNight: 22 });
      expect(result["hourOfNight"]).toBe(2);
    });

    it("handles 0 → 4", () => {
      const result = sc.patchObs({ hourOfNight: 0 });
      expect(result["hourOfNight"]).toBe(4);
    });

    it("preserves other fields", () => {
      const result = sc.patchObs({ hourOfNight: 18, beat: "taproom", playerTrust: 45 });
      expect(result["beat"]).toBe("taproom");
      expect(result["playerTrust"]).toBe(45);
    });

    it("handles missing field (treats as 0, wraps to 4)", () => {
      const result = sc.patchObs({});
      expect(result["hourOfNight"]).toBe(4);
    });

    it("midnight-dread rule: hour outside 0-3 range avoids the rule", () => {
      // hour 21 + 4 = 1 → falls into midnight dread range (0-3)
      const result = sc.patchObs({ hourOfNight: 21 });
      const h = result["hourOfNight"] as number;
      expect(h >= 0 && h <= 3).toBe(true);
    });
  });

  it("patchObs functions are pure (same input → same output)", () => {
    const obs = { beat: "inn-door", playerTrust: 30, hasLantern: false, hasRelicKey: false, hourOfNight: 21 };
    for (const scenario of npc) {
      const r1 = scenario.patchObs({ ...obs });
      const r2 = scenario.patchObs({ ...obs });
      expect(r1).toEqual(r2);
    }
  });

  it("patchObs does not mutate original obs", () => {
    const obs = { playerTrust: 30, hasLantern: false, hasRelicKey: false, hourOfNight: 21 };
    for (const scenario of npc) {
      const copy = { ...obs };
      scenario.patchObs(copy);
      expect(copy).toEqual(obs);
    }
  });
});
