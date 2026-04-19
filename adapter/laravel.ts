import { Step } from "../planner/types.ts";

export function laravelAdapter(step: Step): string {
  const { layer, capability } = step.meta;
  const capitalized = capability.charAt(0).toUpperCase() + capability.slice(1);
  
  if (layer === "entrypoint") return "routes/web.php";
  if (layer === "handler") return `app/Http/Controllers/${capitalized}Controller.php`;
  if (layer === "data_layer") return `app/Models/${capitalized}.php`;
  if (layer === "module") return `app/${capitalized}/`;
  if (layer === "internal") return `app/Utils/${capitalized}.php`;
  
  return step.file; // Fallback
}
