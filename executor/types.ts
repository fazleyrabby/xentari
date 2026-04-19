import { Step } from "../planner/types.ts";

export interface ExecutionState {
  completed: string[];
}

export interface ExecutionResult {
  next: Step | null;
  available: Step[];
}
