import { Step, StepType } from "./types.ts";

export const DEPENDENCY_RULES: Record<StepType, StepType[]> = {
  route: ["controller"],
  controller: ["structure"],
  model: ["structure"],
  refactor: ["model", "controller"],
  structure: []
};

export function resolveDependencies(steps: Step[]): Step[] {
  return steps.map(step => {
    const allowedDepTypes = DEPENDENCY_RULES[step.type] || [];
    
    // Find all steps whose type matches the dependency rules for the current step
    const deps = steps
      .filter(s => allowedDepTypes.includes(s.type))
      .filter(s => s.id !== step.id) // NO SELF DEPENDENCY
      .map(s => s.id)
      .sort(); // REQUIRED for determinism

    return {
      ...step,
      dependsOn: deps
    };
  });
}
