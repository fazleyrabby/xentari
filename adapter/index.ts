import { Plan, Step } from "../planner/types.ts";
import { nodeAdapter } from "./node.ts";
import { laravelAdapter } from "./laravel.ts";

export type AdapterTarget = "node" | "laravel";

export function projectPlan(plan: Plan, target: AdapterTarget): Plan {
  return {
    steps: plan.steps.map(step => {
      let projectedFile = step.file;
      
      if (target === "node") {
        projectedFile = nodeAdapter(step);
      } else if (target === "laravel") {
        projectedFile = laravelAdapter(step);
      }
      
      return {
        ...step,
        projectedFile
      };
    })
  };
}
