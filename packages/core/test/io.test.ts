import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  exportTrace,
  importTrace,
  replay,
  run,
  verifyChain,
  TraceImportError,
  TRACE_SCHEMA_VERSION,
  type AgentDefinition,
  type TraceFile,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Shared agent and helpers (mirrors engine.test.ts)
// ---------------------------------------------------------------------------

type S = { total: number };
type O = { n: number };
type A = { kind: "big" | "small" | "coin"; value: number };

const agent: AgentDefinition<S, O, A> = {
  name: "counter",
  version: "1",
  initialState: { total: 0 },
  rules: [
    {
      id: "big",
      description: "n >= 10",
      evaluate: ({ obs }) =>
        obs.n >= 10 ? { action: { kind: "big", value: obs.n }, reason: `n=${obs.n} >= 10` } : null,
    },
    {
      id: "small",
      description: "n < 0",
      evaluate: ({ obs }) =>
        obs.n < 0 ? { action: { kind: "small", value: obs.n }, reason: "negative" } : null,
    },
  ],
  fallback: ({ rng }) => ({ action: { kind: "coin", value: rng.int(0, 100) }, reason: "coin flip" }),
  reduce: (s, _o, a) => ({ total: s.total + a.value }),
};

const opts = { seed: 7, startMs: 1000, stepMs: 10 };
const baseObs: O[] = [{ n: 12 }, { n: -3 }, { n: 4 }];

const obsArb = fc.array(fc.record({ n: fc.integer({ min: -50, max: 50 }) }), { maxLength: 30 });

// ---------------------------------------------------------------------------
// exportTrace
// ---------------------------------------------------------------------------

describe("exportTrace", () => {
  it("produces valid JSON", () => {
    const trace = run(agent, baseObs, opts);
    const json = exportTrace(trace);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("includes schemaVersion: 1", () => {
    const trace = run(agent, baseObs, opts);
    const file = JSON.parse(exportTrace(trace)) as TraceFile<S, O, A>;
    expect(file.schemaVersion).toBe(TRACE_SCHEMA_VERSION);
  });

  it("embeds the trace unchanged", () => {
    const trace = run(agent, baseObs, opts);
    const file = JSON.parse(exportTrace(trace)) as TraceFile<S, O, A>;
    expect(file.trace.headHash).toBe(trace.headHash);
    expect(file.trace.ghosts).toHaveLength(3);
  });

  it("rejects traces containing non-finite numbers", () => {
    // Build a trace then manually corrupt a field to NaN (bypasses run validation)
    const trace = run(agent, baseObs, opts);
    (trace.ghosts[0]!.timeMs as unknown as number) = NaN;
    expect(() => exportTrace(trace)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// importTrace — happy path
// ---------------------------------------------------------------------------

describe("importTrace — happy path", () => {
  it("parses output of exportTrace without error", () => {
    const trace = run(agent, baseObs, opts);
    const json = exportTrace(trace);
    expect(() => importTrace(json)).not.toThrow();
  });

  it("returns schemaVersion 1 and the original trace fields", () => {
    const trace = run(agent, baseObs, opts);
    const file = importTrace<S, O, A>(exportTrace(trace));
    expect(file.schemaVersion).toBe(1);
    expect(file.trace.agent).toBe("counter");
    expect(file.trace.agentVersion).toBe("1");
    expect(file.trace.headHash).toBe(trace.headHash);
    expect(file.trace.ghosts).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: export → import → verifyChain + replay
// ---------------------------------------------------------------------------

describe("round-trip", () => {
  it("imported trace still passes verifyChain", () => {
    const trace = run(agent, baseObs, opts);
    const { trace: imported } = importTrace<S, O, A>(exportTrace(trace));
    expect(verifyChain(imported)).toMatchObject({ ok: true });
  });

  it("imported trace still replays correctly", () => {
    const trace = run(agent, baseObs, opts);
    const { trace: imported } = importTrace<S, O, A>(exportTrace(trace));
    expect(replay(agent, imported)).toMatchObject({ ok: true });
  });

  it("round-trip preserves headHash exactly", () => {
    const trace = run(agent, baseObs, opts);
    const { trace: imported } = importTrace<S, O, A>(exportTrace(trace));
    expect(imported.headHash).toBe(trace.headHash);
  });

  it("round-trip for any observations (property)", () => {
    fc.assert(
      fc.property(obsArb, (obs) => {
        const trace = run(agent, obs, opts);
        const { trace: imported } = importTrace<S, O, A>(exportTrace(trace));
        return (
          verifyChain(imported).ok &&
          replay(agent, imported).ok &&
          imported.headHash === trace.headHash
        );
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// importTrace — validation failures
// ---------------------------------------------------------------------------

describe("importTrace — validation failures", () => {
  it("throws TraceImportError on invalid JSON", () => {
    expect(() => importTrace("not json")).toThrow(TraceImportError);
    expect(() => importTrace("not json")).toThrow(/invalid JSON/i);
  });

  it("throws when JSON root is not an object", () => {
    expect(() => importTrace('"a string"')).toThrow(TraceImportError);
    expect(() => importTrace("[1,2,3]")).toThrow(TraceImportError);
  });

  it("throws when schemaVersion is missing", () => {
    const { trace } = JSON.parse(exportTrace(run(agent, baseObs, opts))) as TraceFile<S, O, A>;
    expect(() => importTrace(JSON.stringify({ trace }))).toThrow(/schemaVersion/);
  });

  it("throws on unsupported schemaVersion", () => {
    const file = JSON.parse(exportTrace(run(agent, baseObs, opts)));
    file.schemaVersion = 999;
    expect(() => importTrace(JSON.stringify(file))).toThrow(TraceImportError);
    expect(() => importTrace(JSON.stringify(file))).toThrow(/unsupported schemaVersion 999/);
  });

  it("throws on non-integer schemaVersion", () => {
    const file = JSON.parse(exportTrace(run(agent, baseObs, opts)));
    file.schemaVersion = "1";
    expect(() => importTrace(JSON.stringify(file))).toThrow(/schemaVersion/);
  });

  it("throws when trace field is missing", () => {
    expect(() => importTrace(JSON.stringify({ schemaVersion: 1 }))).toThrow(/trace/);
  });

  it("throws when trace.agent is not a string", () => {
    const file = JSON.parse(exportTrace(run(agent, baseObs, opts)));
    file.trace.agent = 42;
    expect(() => importTrace(JSON.stringify(file))).toThrow(/trace\.agent/);
  });

  it("throws when trace.headHash is malformed", () => {
    const file = JSON.parse(exportTrace(run(agent, baseObs, opts)));
    file.trace.headHash = "not-a-hash";
    expect(() => importTrace(JSON.stringify(file))).toThrow(/headHash/);
  });

  it("throws when trace.rulesetHash is malformed", () => {
    const file = JSON.parse(exportTrace(run(agent, baseObs, opts)));
    file.trace.rulesetHash = "tooshort";
    expect(() => importTrace(JSON.stringify(file))).toThrow(/rulesetHash/);
  });

  it("throws when trace.options is missing a field", () => {
    const file = JSON.parse(exportTrace(run(agent, baseObs, opts)));
    delete file.trace.options.seed;
    expect(() => importTrace(JSON.stringify(file))).toThrow(/trace\.options\.seed/);
  });

  it("throws when trace.options.seed is non-finite", () => {
    const file = JSON.parse(exportTrace(run(agent, baseObs, opts)));
    file.trace.options.seed = "seven";
    expect(() => importTrace(JSON.stringify(file))).toThrow(/trace\.options\.seed/);
  });

  it("throws when trace.ghosts is not an array", () => {
    const file = JSON.parse(exportTrace(run(agent, baseObs, opts)));
    file.trace.ghosts = "nope";
    expect(() => importTrace(JSON.stringify(file))).toThrow(/ghosts/);
  });

  it("throws when a ghost is missing ruleId", () => {
    const file = JSON.parse(exportTrace(run(agent, baseObs, opts)));
    delete file.trace.ghosts[0].ruleId;
    expect(() => importTrace(JSON.stringify(file))).toThrow(/ruleId/);
  });

  it("throws when a ghost has a malformed hash", () => {
    const file = JSON.parse(exportTrace(run(agent, baseObs, opts)));
    file.trace.ghosts[0].hash = "badhash";
    expect(() => importTrace(JSON.stringify(file))).toThrow(/ghosts\[0\]\.hash/);
  });

  it("throws when a ghost has a malformed prevHash", () => {
    const file = JSON.parse(exportTrace(run(agent, baseObs, opts)));
    file.trace.ghosts[1].prevHash = "badhash";
    expect(() => importTrace(JSON.stringify(file))).toThrow(/ghosts\[1\]\.prevHash/);
  });
});
