import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";

function validateStack(stack, name) {
  const required = ["patterns", "planner", "validator", "testRunner"];

  for (const key of required) {
    if (!stack[key]) {
      throw new Error(`[STACK ERROR] ${name} missing required export: ${key}`);
    }
  }

  if (typeof stack.planner.generatePlan !== "function") {
    throw new Error(`[STACK ERROR] ${name}.planner.generatePlan must be a function`);
  }

  return true;
}

export async function loadStack(stack) {
  const config = loadConfig();
  const projectRoot = config.root;
  
  // Stacks are in the root 'stacks' directory
  const stackPath = path.join(projectRoot, "stacks", stack, "index.js");
  const fallbackPath = path.join(projectRoot, "stacks", "node-basic", "index.js");

  try {
    const module = await import(pathToFileURL(stackPath).href);
    const stackObj = module.default || module;
    validateStack(stackObj, stack);
    return stackObj;
  } catch (err) {
    console.warn(`[STACK] Failed to load stack '${stack}': ${err.message}. Falling back to node-basic.`);
    try {
      const fallback = await import(pathToFileURL(fallbackPath).href);
      const stackObj = fallback.default || fallback;
      validateStack(stackObj, "node-basic");
      return stackObj;
    } catch (fallbackErr) {
      console.error(`[STACK] Critical: Failed to load fallback stack: ${fallbackErr.message}`);
      return null;
    }
  }
}
