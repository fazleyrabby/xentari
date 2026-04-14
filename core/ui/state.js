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
  refresh: 0
};

export function getState() {
  return state;
}

export function updateState(updates) {
  Object.assign(state, updates);
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
