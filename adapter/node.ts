import { Step } from "../planner/types.ts";

/**
 * PHASE 4 & 5 — ADAPTER FIX (Node)
 * Uses 'subject' for naming and enforces .js extensions.
 */
export function nodeAdapter(step: Step): string {
  const { layer, capability, subject } = step.meta;
  
  // Use subject for naming, fallback to capability
  const name = (subject || capability || "base").toLowerCase();
  
  if (layer === "entrypoint") return `routes/${name}.js`;
  if (layer === "handler") {
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    return `controllers/${capitalized}Controller.js`;
  }
  if (layer === "data_layer") {
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    return `models/${capitalized}.js`;
  }
  if (layer === "module") return `${name}/index.js`;
  if (layer === "internal") return `utils/${name}.js`;
  
  return step.file; // Fallback
}
