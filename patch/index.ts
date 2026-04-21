import { Plan } from "../planner/types.ts";
import { TEMPLATE_MAP } from "./templates.ts";

export interface PatchSpec {
  stepId: string;
  action: "create_file" | "update_file";
  target: string;
  template: string;
  projectType: "node" | "laravel";
  subject: string; // Added
}

export interface PatchSet {
  patches: PatchSpec[];
}

export function normalizeName(base: string): string {
  // Remove suffix if already exists, remove non-alphanumeric, capitalize first letter
  const clean = base
    .replace(/Controller$/i, '')
    .replace(/Model$/i, '')
    .replace(/[^a-zA-Z0-9]/g, '');
    
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function generatePatches(projectedPlan: Plan): PatchSet {
  const patches = projectedPlan.steps.map(step => {
    const layer = step.meta?.layer || "unknown";
    const template = TEMPLATE_MAP[layer] || "general.basic";
    const projectType = step.meta?.projectType || "node";
    const subject = step.meta?.subject || "base";
    
    // TRUST THE ADAPTER: Use projectedFile if provided, fallback to file
    const target = step.projectedFile || step.file;
    
    return {
      stepId: step.id,
      action: "create_file" as const,
      target,
      template,
      projectType,
      subject
    };
  });

  return { patches };
}
