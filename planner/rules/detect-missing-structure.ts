import { Step, PRIORITY_MAP } from "../types.ts";

/**
 * PHASE 6 — DRIFT IMPROVEMENT
 * Checks for missing essential project structure based on detected framework.
 */
export function detectMissingStructure(analysis: string): Step[] {
  const lines = analysis.toLowerCase().split("\n");
  const files = lines.map(line => line.split(" → ")[0].trim()).filter(f => f.length > 0);
  
  const steps: Step[] = [];

  const isLaravel = files.some(f => f === "artisan" || f === "composer.json" || f.startsWith("app/"));

  if (isLaravel) {
    const hasRoutes = files.some(f => f.startsWith("routes/"));
    const hasControllers = files.some(f => f.startsWith("app/http/controllers/"));
    const hasModels = files.some(f => f.startsWith("app/models/"));

    if (!hasRoutes) {
      steps.push({
        id: "struct-1",
        type: "route",
        description: "Enforce Laravel routes structure",
        file: "routes/web.php",
        priority: PRIORITY_MAP.structure,
        dependsOn: [],
        meta: { capability: "structure", layer: "entrypoint", projectType: "laravel" }
      });
    }

    if (!hasControllers) {
      steps.push({
        id: "struct-2",
        type: "controller",
        description: "Enforce Laravel controller structure",
        file: "app/Http/Controllers/Controller.php",
        priority: PRIORITY_MAP.structure,
        dependsOn: [],
        meta: { capability: "structure", layer: "handler", projectType: "laravel" }
      });
    }
  } else {
    // Node/General defaults
    const hasRoutes = files.some(f => f.startsWith("routes/") || f.includes("route"));
    const hasControllers = files.some(f => f.startsWith("controllers/") || f.includes("controller"));
    const hasModels = files.some(f => f.startsWith("models/") || f.includes("model"));

    if (!hasRoutes) {
      steps.push({
        id: "struct-1",
        type: "route",
        description: "Create routes directory structure",
        file: "routes/index.js",
        priority: PRIORITY_MAP.structure,
        dependsOn: [],
        meta: { capability: "structure", layer: "entrypoint" }
      });
    }

    if (!hasControllers) {
      steps.push({
        id: "struct-2",
        type: "controller",
        description: "Create controllers directory structure",
        file: "controllers/BaseController.js",
        priority: PRIORITY_MAP.structure,
        dependsOn: [],
        meta: { capability: "structure", layer: "handler" }
      });
    }

    if (!hasModels) {
      steps.push({
        id: "struct-3",
        type: "model",
        description: "Create models directory structure",
        file: "models/User.js",
        priority: PRIORITY_MAP.structure,
        dependsOn: [],
        meta: { capability: "structure", layer: "data_layer" }
      });
    }
  }

  return steps;
}
