import { Step } from "../planner/types.ts";

export function nodeAdapter(step: Step): string {
  const { layer, capability } = step.meta;
  
  if (layer === "entrypoint") return `routes/${capability}.js`;
  if (layer === "handler") return `controllers/${capability}Controller.js`;
  if (layer === "data_layer") return `models/${capability}.js`;
  if (layer === "module") return `${capability}/index.js`;
  if (layer === "internal") return `utils/${capability}.js`;
  
  return step.file; // Fallback
}
