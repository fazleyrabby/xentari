import { Step, PRIORITY_MAP } from "../types.ts";

export function detectMissingStructure(analysis: string): Step[] {
  const lines = analysis.toLowerCase().split("\n");
  const files = lines.map(line => line.split(" → ")[0].trim()).filter(f => f.length > 0);
  
  const steps: Step[] = [];

  const hasRoutes = files.some(f => f.startsWith("routes/") || f.includes("route"));
  const hasControllers = files.some(f => f.startsWith("controllers/") || f.includes("controller"));
  const hasModels = files.some(f => f.startsWith("models/") || f.includes("model"));

  if (!hasRoutes) {
    steps.push({
      id: "struct-1",
      type: "structure",
      description: "Create routes directory structure",
      file: "routes/index.js",
      priority: PRIORITY_MAP.structure,
      dependsOn: [],
      meta: { capability: "", layer: "" }
    });
  }

  if (!hasControllers) {
    steps.push({
      id: "struct-2",
      type: "structure",
      description: "Create controllers directory structure",
      file: "controllers/BaseController.js",
      priority: PRIORITY_MAP.structure,
      dependsOn: [],
      meta: { capability: "", layer: "" }
    });
  }

  if (!hasModels) {
    steps.push({
      id: "struct-3",
      type: "structure",
      description: "Create models directory structure",
      file: "models/User.js",
      priority: PRIORITY_MAP.structure,
      dependsOn: [],
      meta: { capability: "", layer: "" }
    });
  }

  return steps;
}
