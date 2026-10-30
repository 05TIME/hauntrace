/** Injected clock. Agents must read time from here, never from Date.now(). */
export interface Clock {
  now(): number;
}

/** A clock that advances by a fixed step every time the engine ticks. */
export function steppedClock(startMs: number, stepMs: number): Clock & { tick(): void } {
  let t = startMs;
  return {
    now: () => t,
    tick: () => {
      t += stepMs;
    },
  };
}
