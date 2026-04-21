import { Plan, Step } from "../planner/types.ts";
import { nodeAdapter } from "./node.ts";
import { laravelAdapter } from "./laravel.ts";

export type AdapterTarget = "node" | "laravel";

export function projectPlan(plan: Plan, target: AdapterTarget): Plan {
  return {
    steps: plan.steps.map(step => {
      // PHASE 1 — PROJECT CONTEXT ENFORCEMENT
      // Prioritize projectType in metadata if present (detected by server)
      const effectiveTarget = step.meta.projectType || target;
      
      let projectedFile = step.file;
      
      if (effectiveTarget === "node") {
        projectedFile = nodeAdapter(step);
      } else if (effectiveTarget === "laravel") {
        projectedFile = laravelAdapter(step);
      }
      
      return {
        ...step,
        projectedFile
      };
    })
  };
}
