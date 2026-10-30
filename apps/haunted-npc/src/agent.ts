import type { AgentDefinition, Rule } from "../../../packages/core/src/index.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Mood = "hostile" | "wary" | "neutral" | "warm" | "haunted";

/** One encounter beat. All EXAMPLE data, not real gameplay. */
export interface EncounterObs {
  beat: string;        // scene id, e.g. "inn-door"
  playerTrust: number; // 0–100
  hasLantern: boolean;
  hasRelicKey: boolean;
  hourOfNight: number; // 0–23
  playerAction?: string;
}

export interface NpcState {
  mood: Mood;
  trustDelta: number;
  beatsPlayed: number;
}

export interface NpcAction {
  dialogue: string;
  moodAfter: Mood;
  trustChange: number;
}

// ── Fallback dialogue table ────────────────────────────────────────────────────

const FALLBACK_TABLE: string[] = [
  "The inn is full of shadows tonight… mind your step.",
  "I've seen stranger folk than you pass through this door.",
  "The candles flicker when you speak. Curious.",
  "Would you care for a room? The price is your silence.",
  "Every ghost here was once a traveller, just like you.",
];

// ── Rules ─────────────────────────────────────────────────────────────────────

const rules: Rule<NpcState, EncounterObs, NpcAction>[] = [
  {
    id: "betray",
    description: "Player stole the relic key and trust < 20: block the door, mood → hostile",
    evaluate: ({ state, obs }) => {
      if (obs.hasRelicKey && obs.playerTrust < 20) {
        return {
          action: {
            dialogue: "You dare return here with what you stole? The door is shut to you, thief. LEAVE.",
            moodAfter: "hostile",
            trustChange: -30,
          },
          reason: `Player holds relic key with trust=${obs.playerTrust} (<20): betrayal detected`,
        };
      }
      return null;
    },
  },
  {
    id: "lantern-gift",
    description: "Player offers lantern while NPC is wary or neutral: mood → warm, trust +15",
    evaluate: ({ state, obs }) => {
      if (
        obs.playerAction === "offer-lantern" &&
        obs.hasLantern &&
        (state.mood === "wary" || state.mood === "neutral")
      ) {
        return {
          action: {
            dialogue: "A lantern… the old flame-kind. You ease my chill, stranger. Come in, come in.",
            moodAfter: "warm",
            trustChange: 15,
          },
          reason: `Player offered lantern while mood=${state.mood}: warmth granted`,
        };
      }
      return null;
    },
  },
  {
    id: "midnight-dread",
    description: "Hour 0–3 and mood not haunted: NPC enters haunted trance",
    evaluate: ({ state, obs }) => {
      if (obs.hourOfNight >= 0 && obs.hourOfNight <= 3 && state.mood !== "haunted") {
        return {
          action: {
            dialogue:
              "The… the veil thins now. Do you hear them? The ones who checked in and never checked out…",
            moodAfter: "haunted",
            trustChange: 0,
          },
          reason: `Hour=${obs.hourOfNight} (0–3) while mood=${state.mood}: midnight dread takes hold`,
        };
      }
      return null;
    },
  },
  {
    id: "high-trust",
    description: "Trust ≥ 70: NPC shares a secret, mood → warm",
    evaluate: ({ state, obs }) => {
      if (obs.playerTrust >= 70) {
        return {
          action: {
            dialogue:
              "Since you've proven yourself… there is a passage behind the portrait. Use it wisely.",
            moodAfter: "warm",
            trustChange: 5,
          },
          reason: `playerTrust=${obs.playerTrust} (≥70): secret shared`,
        };
      }
      return null;
    },
  },
  {
    id: "low-trust",
    description: "Trust ≤ 20 and mood not hostile: warning delivered, mood → wary",
    evaluate: ({ state, obs }) => {
      if (obs.playerTrust <= 20 && state.mood !== "hostile") {
        return {
          action: {
            dialogue: "I don't know your face, and I don't trust what I don't know. State your business.",
            moodAfter: "wary",
            trustChange: -5,
          },
          reason: `playerTrust=${obs.playerTrust} (≤20) and mood=${state.mood}: warning issued`,
        };
      }
      return null;
    },
  },
];

// ── Agent definition ──────────────────────────────────────────────────────────

export const hauntedNpcAgent: AgentDefinition<NpcState, EncounterObs, NpcAction> = {
  name: "haunted-npc",
  version: "0.1.0",
  initialState: { mood: "neutral", trustDelta: 0, beatsPlayed: 0 },
  rules,
  fallback: ({ state, rng }) => {
    const idx = rng.int(0, FALLBACK_TABLE.length - 1);
    const dialogue = FALLBACK_TABLE[idx] ?? FALLBACK_TABLE[0]!;
    return {
      action: {
        dialogue,
        moodAfter: state.mood,
        trustChange: 0,
      },
      reason: `No rule fired: seeded random dialogue (idx=${idx})`,
    };
  },
  reduce: (s, _obs, action) => ({
    mood: action.moodAfter,
    trustDelta: s.trustDelta + action.trustChange,
    beatsPlayed: s.beatsPlayed + 1,
  }),
};
