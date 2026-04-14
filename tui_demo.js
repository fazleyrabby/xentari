import { startApp } from "./core/ui/main.js";
import { updateState } from "./core/ui/state.js";

/**
 * Xentari TUI Demo Script
 */

console.log("Starting Xentari TUI in 1s...");

setTimeout(() => {
  startApp();

  // Mock some dynamic updates
  setTimeout(() => {
    updateState({
      header: { stack: "PYTHON", phase: "GENERATING" },
      status: { text: "PROCESSING..." }
    });
  }, 2000);

  setTimeout(() => {
    updateState({
      diff: {
        file: "src/main.py",
        after: "print('Hello Xentari!')",
        before: "print('Hello World')"
      },
      status: { text: "WAITING FOR APPROVAL" }
    });
  }, 4000);

}, 1000);
