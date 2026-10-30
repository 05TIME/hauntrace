/**
 * Viewer-local types that mirror the core Ghost/Trace shapes
 * without importing the Node-only core package.
 */

export interface RunOptions {
  seed: number;
  startMs: number;
  stepMs: number;
}

export interface Ghost {
  step: number;
  timeMs: number;
  obs: unknown;
  stateBefore: unknown;
  ruleId: string;
  reason: string;
  action: unknown;
  stateAfter: unknown;
  prevHash: string;
  hash: string;
}

export interface Trace {
  agent: string;
  agentVersion: string;
  rulesetHash: string;
  options: RunOptions;
  ghosts: Ghost[];
  headHash: string;
}

export interface TraceFile {
  schemaVersion: number;
  trace: Trace;
}

export interface VerifyResult {
  ok: boolean;
  brokenAt?: number;
  reason?: string;
}

export interface GhostDiff {
  step: number;
  before: { ruleId: string; action: unknown; reason: string };
  after: { ruleId: string; action: unknown; reason: string };
}
