import { startLoop } from "./loop.js";
import { handleInput } from "./input.js";

/**
 * Xentari Persistent TUI App Entry
 */
export function startApp() {
  // Start the render loop at 10fps for low CPU overhead
  startLoop(100);

  // Setup non-blocking input
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (key) => {
    // Ctrl+C
    if (key === "\u0003") {
      process.exit();
    }

    handleInput(key);
  });

  // Keep process alive if nothing else is happening
  setInterval(() => {}, 1000);
}
