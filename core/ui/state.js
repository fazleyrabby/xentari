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
