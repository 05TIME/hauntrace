import { describe, it, expect } from "vitest";
import { parseTraceFile, TraceLoadError } from "../src/traceLoader.js";

describe("parseTraceFile", () => {
  it("should parse valid trace JSON", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      trace: {
        agent: "test",
        agentVersion: "1.0",
        rulesetHash: "a".repeat(64),
        options: { seed: 1, startMs: 0, stepMs: 1000 },
        ghosts: [
          {
            step: 0,
            timeMs: 0,
            obs: { x: 1 },
            stateBefore: {},
            ruleId: "r1",
            reason: "test",
            action: { a: 1 },
            stateAfter: {},
            prevHash: "0".repeat(64),
            hash: "b".repeat(64),
          },
        ],
        headHash: "b".repeat(64),
      },
    });
    const result = parseTraceFile(json);
    expect(result.schemaVersion).toBe(1);
    expect(result.trace.agent).toBe("test");
    expect(result.trace.ghosts.length).toBe(1);
  });

  it("should reject invalid JSON", () => {
    expect(() => parseTraceFile("{not valid JSON}")).toThrowError(TraceLoadError);
  });

  it("should reject missing schemaVersion", () => {
    const json = JSON.stringify({ trace: {} });
    expect(() => parseTraceFile(json)).toThrowError(/schemaVersion/);
  });

  it("should reject unsupported schemaVersion", () => {
    const json = JSON.stringify({ schemaVersion: 999, trace: {} });
    expect(() => parseTraceFile(json)).toThrowError(/unsupported schemaVersion/i);
  });

  it("should reject missing trace field", () => {
    const json = JSON.stringify({ schemaVersion: 1 });
    expect(() => parseTraceFile(json)).toThrowError(TraceLoadError);
  });

  it("should reject non-string agent", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      trace: { agent: 123 },
    });
    expect(() => parseTraceFile(json)).toThrowError(/trace.agent must be a string/);
  });

  it("should reject invalid rulesetHash format", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      trace: {
        agent: "a",
        agentVersion: "1",
        rulesetHash: "not-hex",
      },
    });
    expect(() => parseTraceFile(json)).toThrowError(/64-char lowercase hex/);
  });

  it("should reject non-finite options.seed", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      trace: {
        agent: "a",
        agentVersion: "1",
        rulesetHash: "a".repeat(64),
        headHash: "b".repeat(64),
        options: { seed: NaN, startMs: 0, stepMs: 1 },
        ghosts: [],
      },
    });
    expect(() => parseTraceFile(json)).toThrowError(/finite number/);
  });

  it("should reject non-array ghosts", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      trace: {
        agent: "a",
        agentVersion: "1",
        rulesetHash: "a".repeat(64),
        headHash: "b".repeat(64),
        options: { seed: 1, startMs: 0, stepMs: 1 },
        ghosts: "not-an-array",
      },
    });
    expect(() => parseTraceFile(json)).toThrowError(/ghosts.*array/);
  });

  it("should reject ghost with missing hash", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      trace: {
        agent: "a",
        agentVersion: "1",
        rulesetHash: "a".repeat(64),
        headHash: "b".repeat(64),
        options: { seed: 1, startMs: 0, stepMs: 1 },
        ghosts: [
          {
            step: 0,
            timeMs: 0,
            obs: {},
            stateBefore: {},
            ruleId: "r",
            reason: "x",
            action: {},
            stateAfter: {},
            prevHash: "0".repeat(64),
          },
        ],
      },
    });
    expect(() => parseTraceFile(json)).toThrowError(/hash must be a 64-char/);
  });
});
