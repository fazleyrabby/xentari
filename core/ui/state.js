/**
 * Xentari TUI State Machine
 */

export const state = {
  header: {
    stack: "NODE",
    phase: "IDLE"
  },
  status: {
    text: "READY"
  },
  actions: [
    { icon: "▶", type: "INIT", target: "Xentari System" }
  ],
  diff: null,
  trace: [],
  timeline: [],
  scroll: {
    offset: 0
  },
  view: "actions", // actions | timeline | debug
  metrics: null,
  refresh: 0
};

export function getState() {
  return state;
}

export function updateState(updates) {
  Object.assign(state, updates);
  state.refresh++;
}

export function setTimeline(trace) {
  state.timeline = trace;
  state.refresh++;
}

export function setView(view) {
  state.view = view;
  state.refresh++;
}

export function scrollUp() {
  state.scroll.offset = Math.max(0, state.scroll.offset - 1);
  state.refresh++;
}

export function scrollDown(max) {
  state.scroll.offset = Math.min(max, state.scroll.offset + 1);
  state.refresh++;
}

export function addAction(action) {
  state.actions.push(action);
  
  // Cap action history to 20 items to prevent UI overflow (E12/TUI Safety)
  if (state.actions.length > 20) {
    state.actions.shift();
  }

  state.refresh++;
}

export function setStatus(statusUpdates) {
  state.status = { ...state.status, ...statusUpdates };
  state.refresh++;
}

export function setMetrics(metrics) {
  state.metrics = metrics || null;
  state.refresh++;
}
