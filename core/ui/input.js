import { updateState, getState } from "./state.js";

/**
 * Xentari Non-blocking Input Handler
 */
export function handleInput(key) {
  const state = getState();

  switch (key) {
    case "q":
      process.exit();
      break;

    case "r":
      updateState({ status: { text: "REFRESHING..." } });
      setTimeout(() => {
        updateState({ status: { text: "READY" } });
      }, 500);
      break;

    case "a": // Demo: Add action
      const newActions = [...state.actions, { icon: "✔", type: "TASK", target: `Mock task ${state.actions.length}` }];
      updateState({ actions: newActions });
      break;

    default:
      break;
  }
}
