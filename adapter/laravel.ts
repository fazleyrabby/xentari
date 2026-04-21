import { Step } from "../planner/types.ts";

/**
 * PHASE 4 & 5 — ADAPTER FIX (Laravel)
 * Enforces PHP extensions, correct paths, and uses 'subject' for naming.
 */
export function laravelAdapter(step: Step): string {
  const { layer, capability, subject } = step.meta;
  
  // Use subject for naming, fallback to capability (e.g., 'product', 'inventory')
  const name = subject || capability || "Base";
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  
  // Enforce Laravel conventions
  if (layer === "entrypoint") {
    if (capability === "add_auth") return "routes/auth.php";
    return "routes/api.php";
  }

  if (layer === "handler") {
    return `app/Http/Controllers/${capitalized}Controller.php`;
  }

  if (layer === "data_layer") {
    return `app/Models/${capitalized}.php`;
  }

  if (layer === "module") {
    return `app/Domains/${capitalized}/`;
  }

  if (layer === "internal") {
    return `app/Services/${capitalized}Service.php`;
  }
  
  // Ensure no .js files in Laravel
  const file = step.file.replace(/\.js$/, '.php');
  return file;
}
