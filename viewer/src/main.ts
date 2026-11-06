/**
 * Séance – Hauntrace Trace Viewer
 * Main entry point: wires up file loading, UI rendering, and interactions.
 */
import type { Trace, VerifyResult } from "./types.js";
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
import {
  getBadgeState,
  NO_TRACE_BADGE,
  VERIFYING_BADGE,
  type BadgeState,
} from "./getBadgeState.js";
import { getScenariosForAgent, hasScenarios } from "./scenarioRegistry.js";
import { rerunAltTrace } from "./agentRunner.js";
import exampleTraceRaw from "./example-trace.json";
import exampleTraceNpcRaw from "./example-trace-npc.json";
import type { TraceFile } from "./types.js";
import { formatAction } from "./formatAction.js";
import { formatDiffCard } from "./formatDiffCard.js";
import { encodeTrace, decodeTrace, extractPayload, buildShareUrl, ShareLinkError } from "./shareLink.js";
import { explainRun } from "./explainRun.js";
import { selectStartup } from "./startupSelection.js";
import { escapeHtml, escapeJson } from "./escapeHtml.js";

// ── DOM element helpers ──────────────────────────────────────
function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} not found`);
  return e as T;
}

// ── State ────────────────────────────────────────────────────
interface AppState {
  trace: Trace;
  traceFile: TraceFile;
  scrubber: ReturnType<typeof createScrubberState>;
  whatIfScenario: string;
}

let state: AppState | null = null;

// ── Badge rendering ──────────────────────────────────────────
function renderBadge(badgeState: BadgeState): void {
  const badge = el("chain-badge");
  badge.className = `meta-hash-badge${badgeState.cssModifier ? ` ${badgeState.cssModifier}` : ""}`;
  badge.innerHTML = `<span aria-hidden="true">${escapeHtml(badgeState.icon)}</span><span class="badge-label">${escapeHtml(badgeState.label)}</span>`;
}

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

// ── Rebuild what-if scenario dropdown ───────────────────────
function rebuildWhatIfDropdown(agentId: string, preselect?: string): void {
  const select = el<HTMLSelectElement>("whatif-select");
  const noScenariosMsg = el("whatif-no-scenarios");

  // Clear existing options
  select.innerHTML = "";

  const scenarios = getScenariosForAgent(agentId);

  if (scenarios.length === 0) {
    select.hidden = true;
    noScenariosMsg.hidden = false;
    noScenariosMsg.textContent = "No what-if scenarios for this agent.";
    if (state) state.whatIfScenario = "none";
    return;
  }

  select.hidden = false;
  noScenariosMsg.hidden = true;

  // "none" option
  const noneOpt = document.createElement("option");
  noneOpt.value = "none";
  noneOpt.textContent = "— none (show original) —";
  select.appendChild(noneOpt);

  for (const scenario of scenarios) {
    const opt = document.createElement("option");
    opt.value = scenario.id;
    opt.textContent = scenario.label;
    select.appendChild(opt);
  }

  // Apply preselected value if valid
  const validId = preselect && scenarios.some((s) => s.id === preselect) ? preselect : "none";
  select.value = validId;
  if (state) state.whatIfScenario = validId;
}

// ── Load trace ───────────────────────────────────────────────
async function loadTrace(json: string, preselectScenario?: string): Promise<void> {
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
    traceFile: file,
    scrubber: createScrubberState(trace),
    whatIfScenario: "none",
  };

  // Show viewer, hide drop zone
  dropZone.hidden = true;
  viewer.hidden = false;
  el<HTMLButtonElement>("btn-share-link").disabled = false;

  renderMeta(trace);

  // Rebuild dropdown for the loaded agent, optionally preselecting a scenario
  rebuildWhatIfDropdown(trace.agent, preselectScenario);

  renderTimeline(trace, 0, new Set());
  renderScrubber(trace, 0);
  renderStepDetail(0);
  renderExplain();

  // If a scenario was preselected, render what-if immediately
  if (state.whatIfScenario !== "none") {
    renderWhatIf();
  } else {
    renderWhatIf(); // always render to clear/reset overlay
  }

  // Verify chain asynchronously
  renderBadge(VERIFYING_BADGE);
  const result = await verifyChain(trace);
  // Stale-result guard: another trace may have been loaded while we awaited.
  // Only render the verification for the trace that is still current.
  if (state?.trace !== trace) return;
  renderBadge(getBadgeState(result));
  renderExplain(result);
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
      <span class="timeline-rule ${ruleClass(ghost.ruleId)}">${escapeHtml(ruleLabel(ghost.ruleId))}</span>
      <span class="timeline-price">${escapeHtml(formatAction(ghost.action))}</span>
      <span class="timeline-date">${escapeHtml(actionDate(ghost.action))}</span>
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
  const btnPrev = el<HTMLButtonElement>("btn-prev");
  const btnNext = el<HTMLButtonElement>("btn-next");

  if (trace.ghosts.length === 0) {
    scrubber.max = "0";
    scrubber.value = "0";
    scrubber.disabled = true;
    el("scrubber-label").textContent = "No steps";
    btnPrev.disabled = true;
    btnNext.disabled = true;
    return;
  }

  scrubber.disabled = false;
  scrubber.max = String(Math.max(0, trace.ghosts.length - 1));
  scrubber.value = String(step);
  el("scrubber-label").textContent = `Step ${step + 1} of ${trace.ghosts.length}`;
  btnPrev.disabled = step === 0;
  btnNext.disabled = step === trace.ghosts.length - 1;
}

// ── Render step detail ───────────────────────────────────────
function renderStepDetail(step: number): void {
  if (!state) return;
  const ghost = state.trace.ghosts[step];
  if (!ghost) return;

  const card = el("step-detail");
  card.innerHTML = `
    <div class="detail-header">
      <span class="detail-rule-badge ${ruleClass(ghost.ruleId)}">${escapeHtml(ruleLabel(ghost.ruleId))}</span>
      <span class="detail-time">${escapeHtml(formatTime(ghost.timeMs))}</span>
    </div>
    <div class="detail-reason">"${escapeHtml(ghost.reason)}"</div>
    <div class="detail-grids">
      <div class="detail-block">
        <div class="detail-block-title">📋 Observation (obs)</div>
        <pre>${escapeJson(ghost.obs, 2)}</pre>
      </div>
      <div class="detail-block">
        <div class="detail-block-title">⬅️ State Before</div>
        <pre>${escapeJson(ghost.stateBefore, 2)}</pre>
      </div>
      <div class="detail-block">
        <div class="detail-block-title">➡️ State After</div>
        <pre>${escapeJson(ghost.stateAfter, 2)}</pre>
      </div>
    </div>
    <div class="detail-block">
      <div class="detail-block-title">🎯 Action</div>
      <pre>${escapeJson(ghost.action, 2)}</pre>
    </div>
    <div class="detail-hash">
      <span>prevHash:</span> ${escapeHtml(ghost.prevHash)}<br>
      <span>hash:</span> ${escapeHtml(ghost.hash)}
    </div>
  `;
}

// ── Build alt-trace by patching obs AND re-running agent rules ────────────────
//
// The original code only patched obs in each ghost but left ruleId/action/reason
// unchanged, so computeWhatIfDiffs always saw identical decisions (no changes).
//
// The fix: for known agents (haunted-npc, shortlet-pricing) we use rerunAltTrace
// to re-evaluate the agent's rules from scratch over the patched observations,
// starting from the trace's initial state and seed, so every ghost in the alt
// trace reflects what the agent would actually have decided.
function buildAltTrace(s: AppState): Trace {
  const scenarios = getScenariosForAgent(s.trace.agent);
  const scenario = scenarios.find((sc) => sc.id === s.whatIfScenario);

  if (!scenario) return s.trace;

  // Build patched observations from each ghost's obs
  const patchedObs = s.trace.ghosts.map((g) =>
    scenario.patchObs(g.obs as Record<string, unknown>),
  );

  // Re-run the real agent rules over the patched observations so ruleId/action
  // reflect the actual counterfactual decisions (not just the original ones).
  const rerun = rerunAltTrace(s.trace.agent, s.trace, patchedObs);
  if (rerun) return rerun;

  // Fallback for unknown agents: patch obs only (no rule re-evaluation)
  const altGhosts = s.trace.ghosts.map((g, i) => ({
    ...g,
    obs: patchedObs[i] ?? g.obs,
  }));
  return { ...s.trace, ghosts: altGhosts };
}

// ── Render what-if overlay ───────────────────────────────────
function renderWhatIf(): void {
  if (!state) return;
  const overlay = el("whatif-overlay");
  const scenario = state.whatIfScenario;

  if (scenario === "none") {
    overlay.innerHTML =
      '<p class="whatif-empty">Choose a scenario above to see how decisions would change.</p>';
    renderTimeline(state.trace, state.scrubber.currentStep, new Set());
    return;
  }

  const scenarios = getScenariosForAgent(state.trace.agent);
  if (scenarios.length === 0) {
    overlay.innerHTML =
      '<p class="whatif-empty">No what-if scenarios for this agent.</p>';
    renderTimeline(state.trace, state.scrubber.currentStep, new Set());
    return;
  }

  const altTrace = buildAltTrace(state);
  const { diffs, changedSteps } = computeWhatIfDiffs(state.trace, altTrace);

  if (changedSteps.size === 0) {
    overlay.innerHTML =
      '<div class="whatif-no-change">✨ No decisions changed under this scenario.</div>';
    renderTimeline(state.trace, state.scrubber.currentStep, changedSteps);
    return;
  }

  const diffRows = diffs.map((diff) => {
    const origGhost = state!.trace.ghosts[diff.step];
    const altGhost = altTrace.ghosts[diff.step];
    if (!origGhost || !altGhost) return "";

    const card = formatDiffCard(state!.trace.agent, diff, origGhost, altGhost);

    const fieldRows = card.fields
      .map((f) => {
        const origCell = f.changed
          ? `<span class="diff-orig diff-orig--crossed">${escHtml(f.original)}</span>`
          : `<span class="diff-orig">${escHtml(f.original)}</span>`;
        const altCell = `<span class="diff-scenario${f.changed ? " diff-scenario--highlight" : ""}">${escHtml(f.scenario)}</span>`;
        return `
          <div class="diff-field">
            <span class="diff-field-label">${escHtml(f.label)}</span>
            <span class="diff-field-values">
              ${origCell}
              ${f.changed ? '<span class="diff-arrow" aria-hidden="true">→</span>' : ""}
              ${f.changed ? altCell : ""}
            </span>
          </div>`;
      })
      .join("");

    return `
      <div class="whatif-diff-row">
        <div class="whatif-diff-step">Step ${card.step + 1}</div>
        <div class="whatif-diff-title">${escHtml(card.title)}</div>
        <div class="diff-fields">${fieldRows}</div>
        <details class="diff-raw">
          <summary class="diff-raw-toggle">Raw data</summary>
          <div class="diff-raw-grid">
            <div class="diff-raw-block">
              <div class="diff-raw-label">Original obs</div>
              <pre class="diff-raw-pre">${escHtml(card.rawOrigObs)}</pre>
            </div>
            <div class="diff-raw-block">
              <div class="diff-raw-label">Scenario obs</div>
              <pre class="diff-raw-pre">${escHtml(card.rawAltObs)}</pre>
            </div>
            <div class="diff-raw-block">
              <div class="diff-raw-label">Original action</div>
              <pre class="diff-raw-pre">${escHtml(card.rawOrigAction)}</pre>
            </div>
            <div class="diff-raw-block">
              <div class="diff-raw-label">Scenario action</div>
              <pre class="diff-raw-pre">${escHtml(card.rawAltAction)}</pre>
            </div>
          </div>
        </details>
      </div>`;
  });

  overlay.innerHTML = `
    <div class="whatif-summary">
      🔮 <strong>${changedSteps.size}</strong> decision(s) would change.
    </div>
    <div class="whatif-diffs">${diffRows.join("")}</div>
  `;

  renderTimeline(state.trace, state.scrubber.currentStep, changedSteps);
}

/** HTML escaping for trace content (see escapeHtml.ts). */
const escHtml = escapeHtml;

// ── Compute changed steps for current scenario ───────────────
function getChangedSteps(): Set<number> {
  if (!state || state.whatIfScenario === "none") return new Set();
  const altTrace = buildAltTrace(state);
  const { changedSteps } = computeWhatIfDiffs(state.trace, altTrace);
  return changedSteps;
}

// ── Step navigation ──────────────────────────────────────────
function setStep(step: number): void {
  if (!state) return;
  state.scrubber = goToStep(state.scrubber, state.trace, step);
  const s = state.scrubber.currentStep;
  renderScrubber(state.trace, s);
  renderStepDetail(s);
  const changedSteps = getChangedSteps();
  renderTimeline(state.trace, s, changedSteps);
  const items = document.querySelectorAll(".timeline-item");
  items[s]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

// ── Explain this run ─────────────────────────────────────────
/** Render the story. Without a verify result yet, show a placeholder. */
function renderExplain(result?: VerifyResult): void {
  const box = el("explain-content");
  box.textContent = "";
  if (!state) return;
  if (!result) {
    const p = document.createElement("p");
    p.textContent = "Verifying chain before explaining…";
    box.appendChild(p);
    return;
  }
  const story = explainRun(state.trace, result);
  const add = (text: string, cls?: string): void => {
    const p = document.createElement("p");
    if (cls) p.className = cls;
    p.textContent = text; // textContent: trace content is untrusted
    box.appendChild(p);
  };
  add(story.intro);
  story.steps.forEach((s) => add(s, "explain-step"));
  add(story.closing, result.ok ? "explain-closing" : "explain-closing broken");
}

// ── Share links ──────────────────────────────────────────────
function showLoadError(msg: string): void {
  const errBox = el("drop-error");
  errBox.textContent = `⚠️ ${msg}`;
  errBox.hidden = false;
}

async function loadFromShareHash(hash: string): Promise<void> {
  const payload = extractPayload(hash);
  if (payload === null) return;
  try {
    const file = await decodeTrace(payload);
    await loadTrace(JSON.stringify(file));
  } catch (e) {
    showLoadError(e instanceof ShareLinkError ? e.message : `Could not load share link: ${String(e)}`);
  }
}

async function copyShareLink(): Promise<void> {
  if (!state) return;
  const status = el("btn-share-link");
  const original = "🔗 Copy share link";
  try {
    const payload = await encodeTrace(state.traceFile);
    const url = buildShareUrl(globalThis.location?.href ?? "", payload);
    await navigator.clipboard.writeText(url);
    status.textContent = "✅ Link copied";
  } catch (e) {
    status.textContent = e instanceof ShareLinkError ? `⚠️ ${e.message}` : "⚠️ Could not copy link";
  }
  setTimeout(() => {
    status.textContent = original;
  }, 3000);
}

// ── Wire up events ───────────────────────────────────────────
function init(): void {
  // Neutral badge before any trace is loaded
  renderBadge(NO_TRACE_BADGE);

  // Read URL: a #t= share payload always wins over ?example / ?whatif.
  const choice = selectStartup(globalThis.location?.search ?? "", globalThis.location?.hash ?? "");
  if (choice.kind === "share") {
    void loadFromShareHash(globalThis.location?.hash ?? "");
  } else if (choice.kind === "example") {
    const raw = choice.key === "npc" ? exampleTraceNpcRaw : exampleTraceRaw;
    void loadTrace(JSON.stringify(raw), choice.whatif);
  }

  el("btn-share-link").addEventListener("click", () => {
    void copyShareLink();
  });

  // Load example trace button
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
    input.value = "";
  });

  // Drag-and-drop
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
