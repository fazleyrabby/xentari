import { buildDynamicContext } from "./context-engine.js";
import { loadConfig } from "./config.js";

export function getContext(task) {
  return buildDynamicContext(task);
}

// Keep getSummary for backward compatibility
export function getSummary() {
  const { context } = getContext("");
  return context;
}
