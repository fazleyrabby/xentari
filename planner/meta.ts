import { Step, StepType } from "./types.ts";

export const LAYER_MAP: Record<StepType, string> = {
  structure: "module",
  model: "data_layer",
  controller: "handler",
  route: "entrypoint",
  refactor: "internal"
};

export function detectCapability(step: Step): string {
  if (step.id.startsWith("auth")) return "authentication";
  return "general";
}

export function attachMeta(steps: Step[]): Step[] {
  return steps.map(step => ({
    ...step,
    meta: {
      capability: detectCapability(step),
      layer: LAYER_MAP[step.type]
    }
  }));
}
