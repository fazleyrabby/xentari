import { buildDynamicContext } from "./context-engine.js";
import { loadConfig } from "./config.js";

export function getContext(task, projectDir = process.cwd()) {
  return buildDynamicContext(task, projectDir);
}

// Keep getSummary for backward compatibility
export function getSummary() {
  const { context } = getContext("");
  return context;
}
