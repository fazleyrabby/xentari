import { Step, Plan } from "../planner/types.ts";
import { ExecutionState, ExecutionResult } from "./types.ts";

export function getExecutableSteps(plan: Plan, state: ExecutionState): Step[] {
  return plan.steps
    .filter(step => {
      // 1. skip already completed
      if (state.completed.includes(step.id)) return false;

      // 2. all dependencies must be met
      return step.dependsOn.every(dep =>
        state.completed.includes(dep)
      );
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.id.localeCompare(b.id);
    });
}

export function getNextStep(plan: Plan, state: ExecutionState): Step | null {
  const available = getExecutableSteps(plan, state);
  return available.length > 0 ? available[0] : null;
}

export function execute(plan: Plan, state: ExecutionState): ExecutionResult {
  const available = getExecutableSteps(plan, state);
  return {
    next: available.length > 0 ? available[0] : null,
    available
  };
}
