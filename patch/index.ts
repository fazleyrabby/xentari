import { Plan } from "../planner/types.ts";
import { TEMPLATE_MAP } from "./templates.ts";

export interface PatchSpec {
  stepId: string;
  action: "create_file" | "update_file";
  target: string;
  template: string;
}

export interface PatchSet {
  patches: PatchSpec[];
}

export function generatePatches(projectedPlan: Plan): PatchSet {
  const patches = projectedPlan.steps.map(step => {
    const layer = step.meta?.layer || "unknown";
    const template = TEMPLATE_MAP[layer] || "general.basic";
    
    return {
      stepId: step.id,
      action: "create_file" as const,
      target: step.projectedFile || step.file,
      template
    };
  });

  return { patches };
}
