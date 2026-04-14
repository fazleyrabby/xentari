import { updateState, getState, scrollUp, scrollDown, setView } from "./state.js";

/**
 * Xentari Non-blocking Input Handler
 */
export function handleInput(key) {
  const state = getState();

  if (key === "q") {
    process.exit();
  }

  // View Switching
  if (key === "1") setView("actions");
  if (key === "2") setView("timeline");
  if (key === "3") setView("debug");

  // Scrolling
  if (key === "j") {
    let max = 0;
    if (state.view === "actions") max = Math.max(0, state.actions.length - 15);
    if (state.view === "timeline") max = Math.max(0, state.timeline.length - 15);
    scrollDown(max);
  }
  if (key === "k") {
    scrollUp();
  }

  switch (key) {
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
