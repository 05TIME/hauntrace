/**
 * Scenario registry: maps agent id → what-if scenarios.
 *
 * Each scenario has:
 *  - id:          unique string used in URL params and select values
 *  - label:       human-readable dropdown text
 *  - patchObs:    pure function that patches a single observation
 *
 * The viewer calls patchObs on every ghost's obs to build an alt-trace,
 * then feeds both traces to computeWhatIfDiffs to surface changed decisions.
 *
 * Rules: patchObs must be a pure function of its input (no side effects,
 * no Date.now(), no Math.random()).
 */

export interface WhatIfScenario {
  id: string;
  label: string;
  patchObs: (obs: Record<string, unknown>) => Record<string, unknown>;
}

// ── Shortlet-pricing scenarios ────────────────────────────────────────────────

const shortletScenarios: WhatIfScenario[] = [
  {
    id: "occupancy+20",
    label: "Area occupancy +20 pts",
    patchObs: (obs) => {
      const cur = typeof obs["areaOccupancyPct"] === "number" ? obs["areaOccupancyPct"] : 0;
      return { ...obs, areaOccupancyPct: Math.min(100, cur + 20) };
    },
  },
  {
    id: "occupancy-20",
    label: "Area occupancy −20 pts",
    patchObs: (obs) => {
      const cur = typeof obs["areaOccupancyPct"] === "number" ? obs["areaOccupancyPct"] : 0;
      return { ...obs, areaOccupancyPct: Math.max(0, cur - 20) };
    },
  },
  {
    id: "no-events",
    label: "Remove all local events",
    patchObs: (obs) => ({ ...obs, localEvent: null }),
  },
  {
    id: "all-weekend",
    label: "Mark all nights as weekend",
    patchObs: (obs) => ({ ...obs, isWeekend: true }),
  },
];

// ── Haunted-NPC scenarios ─────────────────────────────────────────────────────

const npcScenarios: WhatIfScenario[] = [
  {
    id: "npc-has-lantern",
    label: "Player brought the lantern",
    patchObs: (obs) => ({
      ...obs,
      hasLantern: true,
      // Give the player a reason to offer it so lantern-gift rule can fire
      playerAction: obs["playerAction"] ?? "offer-lantern",
    }),
  },
  {
    id: "npc-has-relic-key",
    label: "Player has the relic key",
    patchObs: (obs) => ({ ...obs, hasRelicKey: true }),
  },
  {
    id: "npc-trust-high",
    label: "Higher player trust (+40)",
    patchObs: (obs) => {
      const cur = typeof obs["playerTrust"] === "number" ? obs["playerTrust"] : 0;
      return { ...obs, playerTrust: Math.min(100, cur + 40) };
    },
  },
  {
    id: "npc-trust-low",
    label: "Lower player trust (−40)",
    patchObs: (obs) => {
      const cur = typeof obs["playerTrust"] === "number" ? obs["playerTrust"] : 0;
      return { ...obs, playerTrust: Math.max(0, cur - 40) };
    },
  },
  {
    id: "npc-later-hour",
    label: "Later hour of night (+4 hours)",
    patchObs: (obs) => {
      const cur = typeof obs["hourOfNight"] === "number" ? obs["hourOfNight"] : 0;
      return { ...obs, hourOfNight: (cur + 4) % 24 };
    },
  },
];

// ── Registry ──────────────────────────────────────────────────────────────────

const REGISTRY: Record<string, WhatIfScenario[]> = {
  "shortlet-pricing": shortletScenarios,
  "haunted-npc": npcScenarios,
};

/**
 * Returns the list of what-if scenarios for the given agent id.
 * Returns an empty array for unknown agents (caller should show a message).
 */
export function getScenariosForAgent(agentId: string): WhatIfScenario[] {
  return REGISTRY[agentId] ?? [];
}

/**
 * Returns true if there are registered scenarios for the given agent id.
 */
export function hasScenarios(agentId: string): boolean {
  return agentId in REGISTRY;
}
