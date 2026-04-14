import { renderFrame } from "./frame.js";

/**
 * UI Refresh Loop
 */
export function startLoop(ms = 100) {
  setInterval(() => {
    renderFrame();
  }, ms);
}
