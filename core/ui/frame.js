import { getState } from "./state.js";
import { splitPanels } from "./layout.js";
import { normalize } from "./normalize.js";

/**
 * Padds a string with spaces to a fixed width
 */
function pad(str, width) {
  const norm = normalize(str);
  if (norm.length >= width) {
    return norm.slice(0, width - 1) + "…";
  }
  return norm + " ".repeat(Math.max(0, width - norm.length));
}

/**
 * Renders the execution timeline panel
 */
function renderTimeline(timeline, height = 15, offset = 0) {
  const slice = timeline.slice(offset, offset + height);

  return slice.map(t => {
    return pad(`[${t.type}] ${t.command || t.reason || ""}`, process.stdout.columns || 80);
  }).join("\n");
}

/**
 * Renders scrollable action history
 */
function renderScrollable(list, height = 15, offset = 0) {
  const slice = list.slice(offset, offset + height);

  return slice.map(a =>
    pad(`${a.icon} ${a.type.toUpperCase()} ${a.target}`, process.stdout.columns || 80)
  ).join("\n");
}

/**
 * Renders the debug info panel
 */
function renderDebug(trace, snapshots = []) {
  const last = trace[trace.length - 1];

  return [
    pad("DEBUG PANEL", process.stdout.columns || 80),
    pad(`Last Step: ${last?.command || "-"}`, process.stdout.columns || 80),
    pad(`Type: ${last?.type || "-"}`, process.stdout.columns || 80),
    pad(`Time: ${last?.time || "-"}`, process.stdout.columns || 80),
    pad(`Snapshots: ${snapshots?.length || 0}`, process.stdout.columns || 80)
  ].join("\n");
}

/**
 * Renders the side-by-side panel regions
 */
function renderPanels() {
  const state = getState();
  const { leftWidth, rightWidth } = splitPanels();

  // LEFT: Permanent Status / Info
  const left = [
    pad(`STACK: ${state.header.stack}`, leftWidth),
    pad(`PHASE: ${state.header.phase}`, leftWidth),
    pad(`VIEW:  ${state.view.toUpperCase()}`, leftWidth),
    pad(`SCROLL: ${state.scroll.offset}`, leftWidth),
    "",
    pad("HOTKEYS:", leftWidth),
    pad("1: Actions", leftWidth),
    pad("2: Timeline", leftWidth),
    pad("3: Debug", leftWidth),
    pad("j/k: Scroll", leftWidth),
    pad("q: Quit", leftWidth)
  ];

  // RIGHT: Dynamic content based on state.view
  let rightContent = [];
  if (state.view === "actions") {
    rightContent = state.actions.slice(state.scroll.offset, state.scroll.offset + 15)
      .map(a => pad(`${a.icon} ${a.type.toUpperCase()} ${a.target}`, rightWidth));
  } else if (state.view === "timeline") {
    rightContent = state.timeline.slice(state.scroll.offset, state.scroll.offset + 15)
      .map(t => pad(`[${t.type}] ${t.command || t.reason || ""}`, rightWidth));
  } else if (state.view === "debug") {
    rightContent = renderDebug(state.timeline, []).split("\n").map(line => pad(line, rightWidth));
  }

  const maxLines = Math.max(left.length, rightContent.length);
  let output = "";

  for (let i = 0; i < maxLines; i++) {
    const l = left[i] || " ".repeat(leftWidth);
    const r = rightContent[i] || "";

    output += `${l} │ ${r}\n`;
  }

  return output;
}

/**
 * Renders a full TUI frame
 */
export function renderFrame() {
  const state = getState();

  // Clean terminal and move to top (non-flicker method)
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');

  console.log(`🧠 XENTARI | ${state.header.stack} | ${state.header.phase}`);
  console.log("─".repeat(process.stdout.columns || 80));
  process.stdout.write(renderPanels());
  console.log("─".repeat(process.stdout.columns || 80));
  
  const m = state.metrics;
  const metricsLine = m 
    ? `TOKENS: ${m.totalTokens || "-"} | TPS: ${m.tokensPerSecond || "-"} | LAT: ${m.latencyMs || "-"}ms`
    : "METRICS: N/A";
  
  console.log(`STATUS: ${state.status.text} | ${metricsLine}`);
}
