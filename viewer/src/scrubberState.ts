/**
 * Pure view-model for the timeline scrubber.
 * Tracks current step index and computes derived display data.
 */
import type { Ghost, Trace } from "./types.js";

export interface ScrubberState {
  /** 0-based index of the currently selected step */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** The ghost at currentStep, or null if trace is empty */
  currentGhost: Ghost | null;
}

export function createScrubberState(trace: Trace): ScrubberState {
  const totalSteps = trace.ghosts.length;
  const currentStep = 0;
  const currentGhost = trace.ghosts[0] ?? null;
  return { currentStep, totalSteps, currentGhost };
}

export function goToStep(state: ScrubberState, trace: Trace, step: number): ScrubberState {
  const clamped = Math.max(0, Math.min(trace.ghosts.length - 1, Math.round(step)));
  return {
    currentStep: clamped,
    totalSteps: state.totalSteps,
    currentGhost: trace.ghosts[clamped] ?? null,
  };
}

export function nextStep(state: ScrubberState, trace: Trace): ScrubberState {
  return goToStep(state, trace, state.currentStep + 1);
}

export function prevStep(state: ScrubberState, trace: Trace): ScrubberState {
  return goToStep(state, trace, state.currentStep - 1);
}

/** Returns a human-readable timestamp string for a ghost's timeMs. */
export function formatTime(timeMs: number): string {
  return new Date(timeMs).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

/** Returns the rule label with a spooky emoji for known rule IDs. */
export function ruleLabel(ruleId: string): string {
  const labels: Record<string, string> = {
    "event-surge": "🎃 Event Surge",
    "last-minute": "💀 Last Minute",
    "high-demand": "👻 High Demand",
    weekend: "🕷️ Weekend",
    fallback: "🦇 Fallback",
  };
  return labels[ruleId] ?? `👁️ ${ruleId}`;
}
