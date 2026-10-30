/**
 * Séance – Hauntrace Trace Viewer
 * Main entry point: wires up file loading, UI rendering, and interactions.
 */
import type { Trace } from "./types.js";
import { parseTraceFile, TraceLoadError } from "./traceLoader.js";
import { verifyChain } from "./verifyChain.js";
import {
  createScrubberState,
  goToStep,
  nextStep,
  prevStep,
  formatTime,
  ruleLabel,
} from "./scrubberState.js";
import { computeWhatIfDiffs } from "./whatIfDiff.js";
import exampleTraceRaw from "./example-trace.json";
import type { TraceFile } from "./types.js";

// ── DOM element helpers ──────────────────────────────────────
function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} not found`);
  return e as T;
}

// ── State ────────────────────────────────────────────────────
interface AppState {
  trace: Trace;
  scrubber: ReturnType<typeof createScrubberState>;
  whatIfScenario: string;
}

let state: AppState | null = null;

// ── Rule colour class ────────────────────────────────────────
function ruleClass(ruleId: string): string {
  const map: Record<string, string> = {
    "event-surge": "rule-event-surge",
    "last-minute": "rule-last-minute",
    "high-demand": "rule-high-demand",
    weekend: "rule-weekend",
    fallback: "rule-fallback",
  };
  return map[ruleId] ?? "rule-fallback";
}

// ── Try to extract a display price from action ───────────────
function actionPrice(action: unknown): string {
  if (typeof action === "object" && action !== null && "price" in action) {
    return `${(action as { price: number }).price}`;
  }
  return JSON.stringify(action);
}

function actionDate(action: unknown): string {
  if (typeof action === "object" && action !== null && "date" in action) {
    return String((action as { date: string }).date);
  }
  return "";
}

// ── Load trace ───────────────────────────────────────────────
async function loadTrace(json: string): Promise<void> {
  const dropZone = el("drop-zone");
  const viewer = el("viewer");
  const errBox = el("drop-error");
  errBox.hidden = true;
  errBox.textContent = "";

  let file: TraceFile;
  try {
    file = parseTraceFile(json);
  } catch (e) {
    const msg = e instanceof TraceLoadError ? e.message : String(e);
    errBox.textContent = `⚠️ ${msg}`;
    errBox.hidden = false;
    return;
  }

  const { trace } = file;
  state = {
    trace,
    scrubber: createScrubberState(trace),
    whatIfScenario: "none",
  };

  // Show viewer, hide drop zone
  dropZone.hidden = true;
  viewer.hidden = false;

  renderMeta(trace);
  renderTimeline(trace, 0, new Set());
  renderScrubber(trace, 0);
  renderStepDetail(0);

  // Verify chain asynchronously
  const badge = el("chain-badge");
  badge.className = "meta-hash-badge";
  badge.innerHTML =
    '<span class="badge-spinner" aria-hidden="true">⏳</span><span class="badge-label">Verifying chain…</span>';
  const result = await verifyChain(trace);
  if (result.ok) {
    badge.className = "meta-hash-badge verified";
    badge.innerHTML =
      '<span aria-hidden="true">✅</span><span class="badge-label">Chain verified</span>';
  } else {
    badge.className = "meta-hash-badge broken";
    const detail = result.brokenAt !== undefined ? ` at step ${result.brokenAt}` : "";
    badge.innerHTML = `<span aria-hidden="true">❌</span><span class="badge-label">Chain broken${detail}: ${result.reason ?? ""}</span>`;
  }
}

// ── Render meta bar ──────────────────────────────────────────
function renderMeta(trace: Trace): void {
  el("meta-agent-name").textContent = trace.agent;
  el("meta-agent-version").textContent = `v${trace.agentVersion}`;
  el("meta-step-count").textContent = String(trace.ghosts.length);
}

// ── Render timeline ──────────────────────────────────────────
function renderTimeline(
  trace: Trace,
  activeStep: number,
  changedSteps: Set<number>,
): void {
  const container = el("timeline");
  container.innerHTML = "";
  trace.ghosts.forEach((ghost, i) => {
    const item = document.createElement("div");
    item.className = "timeline-item";
    item.setAttribute("role", "listitem");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-label", `Step ${i + 1}: ${ruleLabel(ghost.ruleId)}, ${actionDate(ghost.action)}`);
    if (i === activeStep) item.classList.add("active");
    if (changedSteps.has(i)) item.classList.add("changed");

    item.innerHTML = `
      <span class="timeline-step">Step ${i + 1}</span>
      <span class="timeline-rule ${ruleClass(ghost.ruleId)}">${ruleLabel(ghost.ruleId)}</span>
      <span class="timeline-price">${actionPrice(ghost.action)}</span>
      <span class="timeline-date">${actionDate(ghost.action)}</span>
    `;

    item.addEventListener("click", () => setStep(i));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setStep(i);
      }
    });

    container.appendChild(item);
  });
}

// ── Render scrubber ──────────────────────────────────────────
function renderScrubber(trace: Trace, step: number): void {
  const scrubber = el<HTMLInputElement>("scrubber");
  scrubber.max = String(Math.max(0, trace.ghosts.length - 1));
  scrubber.value = String(step);
  el("scrubber-label").textContent = `Step ${step + 1} of ${trace.ghosts.length}`;
  el<HTMLButtonElement>("btn-prev").disabled = step === 0;
  el<HTMLButtonElement>("btn-next").disabled = step === trace.ghosts.length - 1;
}

// ── Render step detail ───────────────────────────────────────
function renderStepDetail(step: number): void {
  if (!state) return;
  const ghost = state.trace.ghosts[step];
  if (!ghost) return;

  const card = el("step-detail");
  card.innerHTML = `
    <div class="detail-header">
      <span class="detail-rule-badge ${ruleClass(ghost.ruleId)}">${ruleLabel(ghost.ruleId)}</span>
      <span class="detail-time">${formatTime(ghost.timeMs)}</span>
    </div>
    <div class="detail-reason">"${ghost.reason}"</div>
    <div class="detail-grids">
      <div class="detail-block">
        <div class="detail-block-title">📋 Observation (obs)</div>
        <pre>${JSON.stringify(ghost.obs, null, 2)}</pre>
      </div>
      <div class="detail-block">
        <div class="detail-block-title">⬅️ State Before</div>
        <pre>${JSON.stringify(ghost.stateBefore, null, 2)}</pre>
      </div>
      <div class="detail-block">
        <div class="detail-block-title">➡️ State After</div>
        <pre>${JSON.stringify(ghost.stateAfter, null, 2)}</pre>
      </div>
    </div>
    <div class="detail-block">
      <div class="detail-block-title">🎯 Action</div>
      <pre>${JSON.stringify(ghost.action, null, 2)}</pre>
    </div>
    <div class="detail-hash">
      <span>prevHash:</span> ${ghost.prevHash}<br>
      <span>hash:</span> ${ghost.hash}
    </div>
  `;
}

// ── Render what-if overlay ───────────────────────────────────
function renderWhatIf(): void {
  if (!state) return;
  const overlay = el("whatif-overlay");
  const scenario = state.whatIfScenario;

  if (scenario === "none") {
    overlay.innerHTML =
      '<p class="whatif-empty">Choose a scenario above to see how decisions would change.</p>';
    // Re-render timeline without changed markers
    renderTimeline(state.trace, state.scrubber.currentStep, new Set());
    return;
  }

  // Build alternative trace by patching observations
  const altGhosts = state.trace.ghosts.map((g) => {
    const obs = g.obs as Record<string, unknown>;
    let patched = { ...obs };
    if (scenario === "occupancy+20") {
      const cur = typeof obs["areaOccupancyPct"] === "number" ? obs["areaOccupancyPct"] : 0;
      patched = { ...obs, areaOccupancyPct: Math.min(100, cur + 20) };
    } else if (scenario === "occupancy-20") {
      const cur = typeof obs["areaOccupancyPct"] === "number" ? obs["areaOccupancyPct"] : 0;
      patched = { ...obs, areaOccupancyPct: Math.max(0, cur - 20) };
    } else if (scenario === "no-events") {
      patched = { ...obs, localEvent: null };
    } else if (scenario === "all-weekend") {
      patched = { ...obs, isWeekend: true };
    }
    return { ...g, obs: patched };
  });

  // We don't re-run the full engine in the browser (no agent code here),
  // so we produce a "simulated" alt trace by showing what observations changed.
  // For real what-if, the viewer uses the diff against observation changes only.
  // Mark which steps have changed observations vs original.
  const changedSteps = new Set<number>();
  const diffRows: string[] = [];

  state.trace.ghosts.forEach((orig, i) => {
    const alt = altGhosts[i];
    if (!alt) return;
    const origObs = JSON.stringify(orig.obs);
    const altObs = JSON.stringify(alt.obs);
    if (origObs !== altObs) {
      changedSteps.add(i);
    }
  });

  // Build display: show original decision + note that obs changed
  if (changedSteps.size === 0) {
    overlay.innerHTML =
      '<div class="whatif-no-change">✨ No observations changed under this scenario.</div>';
    renderTimeline(state.trace, state.scrubber.currentStep, changedSteps);
    return;
  }

  changedSteps.forEach((i) => {
    const orig = state!.trace.ghosts[i];
    const alt = altGhosts[i];
    if (!orig || !alt) return;
    diffRows.push(`
      <div class="whatif-diff-row">
        <div class="whatif-diff-step">Step ${i + 1} · ${actionDate(orig.action)}</div>
        <div class="whatif-diff-before">
          <span>obs:</span> ${JSON.stringify(orig.obs)}
        </div>
        <div class="whatif-diff-arrow">↓ patched →</div>
        <div class="whatif-diff-after">
          <span>obs:</span> ${JSON.stringify(alt.obs)}
        </div>
      </div>
    `);
  });

  overlay.innerHTML = `
    <div class="whatif-summary">
      🔮 <strong>${changedSteps.size}</strong> step(s) would have different observations.
      The original decisions are shown; use the engine's <code>whatIf()</code> to rerun with the patched trace.
    </div>
    <div class="whatif-diffs">${diffRows.join("")}</div>
  `;

  renderTimeline(state.trace, state.scrubber.currentStep, changedSteps);
}

// ── Step navigation ──────────────────────────────────────────
function setStep(step: number): void {
  if (!state) return;
  state.scrubber = goToStep(state.scrubber, state.trace, step);
  const s = state.scrubber.currentStep;
  renderScrubber(state.trace, s);
  renderStepDetail(s);
  // Refresh timeline to update active step
  const changedSteps = getChangedSteps();
  renderTimeline(state.trace, s, changedSteps);
  // Scroll active item into view
  const items = document.querySelectorAll(".timeline-item");
  items[s]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

function getChangedSteps(): Set<number> {
  if (!state || state.whatIfScenario === "none") return new Set();
  const altGhosts = buildAltGhosts(state);
  const changed = new Set<number>();
  state.trace.ghosts.forEach((orig, i) => {
    const alt = altGhosts[i];
    if (alt && JSON.stringify(orig.obs) !== JSON.stringify(alt.obs)) changed.add(i);
  });
  return changed;
}

function buildAltGhosts(s: AppState): typeof s.trace.ghosts {
  return s.trace.ghosts.map((g) => {
    const obs = g.obs as Record<string, unknown>;
    let patched = { ...obs };
    if (s.whatIfScenario === "occupancy+20") {
      const cur = typeof obs["areaOccupancyPct"] === "number" ? obs["areaOccupancyPct"] : 0;
      patched = { ...obs, areaOccupancyPct: Math.min(100, cur + 20) };
    } else if (s.whatIfScenario === "occupancy-20") {
      const cur = typeof obs["areaOccupancyPct"] === "number" ? obs["areaOccupancyPct"] : 0;
      patched = { ...obs, areaOccupancyPct: Math.max(0, cur - 20) };
    } else if (s.whatIfScenario === "no-events") {
      patched = { ...obs, localEvent: null };
    } else if (s.whatIfScenario === "all-weekend") {
      patched = { ...obs, isWeekend: true };
    }
    return { ...g, obs: patched };
  });
}

// ── Wire up events ───────────────────────────────────────────
function init(): void {
  // Load example trace
  el("btn-load-example").addEventListener("click", () => {
    void loadTrace(JSON.stringify(exampleTraceRaw));
  });

  // File input
  el<HTMLInputElement>("file-input").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void loadTrace(reader.result as string);
    };
    reader.readAsText(file);
    // Reset so same file can be re-loaded
    input.value = "";
  });

  // Drag-and-drop on the whole page
  const dropZone = el("drop-zone");

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  document.addEventListener("dragleave", (e) => {
    if (e.relatedTarget === null) {
      dropZone.classList.remove("drag-over");
    }
  });

  document.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void loadTrace(reader.result as string);
    };
    reader.readAsText(file);
  });

  // Scrubber input
  el<HTMLInputElement>("scrubber").addEventListener("input", (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    setStep(val);
  });

  // Prev/Next buttons
  el("btn-prev").addEventListener("click", () => {
    if (!state) return;
    state.scrubber = prevStep(state.scrubber, state.trace);
    setStep(state.scrubber.currentStep);
  });

  el("btn-next").addEventListener("click", () => {
    if (!state) return;
    state.scrubber = nextStep(state.scrubber, state.trace);
    setStep(state.scrubber.currentStep);
  });

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (!state) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      state.scrubber = prevStep(state.scrubber, state.trace);
      setStep(state.scrubber.currentStep);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      state.scrubber = nextStep(state.scrubber, state.trace);
      setStep(state.scrubber.currentStep);
    }
  });

  // What-if scenario selector
  el<HTMLSelectElement>("whatif-select").addEventListener("change", (e) => {
    if (!state) return;
    state.whatIfScenario = (e.target as HTMLSelectElement).value;
    renderWhatIf();
  });
}

init();
