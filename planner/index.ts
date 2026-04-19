import { Plan } from "./types.ts";
import { detectAuth } from "./rules/detect-auth.ts";
import { detectMissingStructure } from "./rules/detect-missing-structure.ts";
import { resolveDependencies } from "./dependencies.ts";
import { attachMeta } from "./meta.ts";

export function buildPlan(analysis: string): Plan {
  // 1. generate steps
  let steps = [
    ...detectAuth(analysis),
    ...detectMissingStructure(analysis)
  ];

  // 2. assign priority (assigned at creation time)

  // 3. sort steps
  steps.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.id.localeCompare(b.id);
  });

  // 4. resolve dependencies
  steps = resolveDependencies(steps);

  // 5. attach meta
  steps = attachMeta(steps);

  return { steps };
}
