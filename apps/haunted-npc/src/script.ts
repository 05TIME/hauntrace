import type { EncounterObs } from "./agent.js";

/**
 * EXAMPLE six-beat encounter script for the haunted inn.
 * All data is synthetic and labelled EXAMPLE.
 *
 * Beat coverage:
 *   beat 0 → low-trust     (trust=15, not hostile)
 *   beat 1 → lantern-gift  (offer-lantern while wary)
 *   beat 2 → midnight-dread (hour=1, mood not haunted)
 *   beat 3 → fallback      (hour=4, trust=45, no special action)
 *   beat 4 → high-trust    (trust=75)
 *   beat 5 → betray        (hasRelicKey=true, trust=10)
 */
export const encounterScript: EncounterObs[] = [
  // beat 0: low-trust warning
  {
    beat: "inn-door",
    playerTrust: 15,
    hasLantern: false,
    hasRelicKey: false,
    hourOfNight: 21,
  },
  // beat 1: player offers lantern → lantern-gift (mood was wary from beat 0)
  {
    beat: "inn-lobby",
    playerTrust: 10,
    hasLantern: true,
    hasRelicKey: false,
    hourOfNight: 21,
    playerAction: "offer-lantern",
  },
  // beat 2: midnight hour → midnight-dread (mood was warm, not haunted)
  {
    beat: "corridor",
    playerTrust: 25,
    hasLantern: true,
    hasRelicKey: false,
    hourOfNight: 1,
  },
  // beat 3: fallback (hour=4, trust=45, mood haunted — no rule fires)
  {
    beat: "taproom",
    playerTrust: 45,
    hasLantern: true,
    hasRelicKey: false,
    hourOfNight: 4,
  },
  // beat 4: high-trust secret
  {
    beat: "upper-hall",
    playerTrust: 75,
    hasLantern: true,
    hasRelicKey: false,
    hourOfNight: 22,
  },
  // beat 5: betrayal — player stole the relic key, trust plummets
  {
    beat: "vault-door",
    playerTrust: 10,
    hasLantern: false,
    hasRelicKey: true,
    hourOfNight: 23,
  },
];
