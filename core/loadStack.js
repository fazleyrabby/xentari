import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";

export async function loadStack(stack) {
  const config = loadConfig();
  const projectRoot = config.root;
  
  // Stacks are in the root 'stacks' directory
  const stackPath = path.join(projectRoot, "stacks", stack, "index.js");
  const fallbackPath = path.join(projectRoot, "stacks", "node-basic", "index.js");

  try {
    const module = await import(pathToFileURL(stackPath).href);
    return module.default || module;
  } catch (err) {
    console.warn(`[STACK] Failed to load stack '${stack}': ${err.message}. Falling back to node-basic.`);
    try {
      const fallback = await import(pathToFileURL(fallbackPath).href);
      return fallback.default || fallback;
    } catch (fallbackErr) {
      console.error(`[STACK] Critical: Failed to load fallback stack: ${fallbackErr.message}`);
      return null;
    }
  }
}
