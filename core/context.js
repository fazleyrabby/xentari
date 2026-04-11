import { buildContext } from "./context-engine.js";
import { loadConfig } from "./config.js";

export function getContext(task) {
  const config = loadConfig();
  const root = config.root;

  const { context, stack } = buildContext({ root, task });

  return { context, stack };
}

// Keep getSummary for backward compatibility during transition if needed
export function getSummary() {
  const { context } = getContext("");
  return context;
}
