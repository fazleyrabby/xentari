export type StepType = "route" | "controller" | "model" | "refactor" | "structure";

export const PRIORITY_MAP: Record<StepType, number> = {
  structure: 1,
  model: 2,
  controller: 3,
  route: 4,
  refactor: 5
};

export interface StepMeta {
  capability: string;
  layer: string;
}

export interface Step {
  id: string;
  type: StepType;
  description: string;
  file: string;
  priority: number;
  dependsOn: string[];
  meta: StepMeta;
  projectedFile?: string;
}

export interface Plan {
  steps: Step[];
}
