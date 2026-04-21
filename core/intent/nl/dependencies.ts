import { AllowedIntent } from "../llamaParser.ts";

/**
 * PHASE 1 — DEFINE DEPENDENCY MAP
 * Static rules only. No dynamic inference.
 */
export const INTENT_DEPENDENCIES: Record<AllowedIntent, AllowedIntent[]> = {
  "create_route": ["add_auth", "add_controller"],
  "add_auth": [],
  "add_controller": [],
  "refactor_structure": []
};

/**
 * PHASE 2 & 3: BUILD DEPENDENCY GRAPH & TOPOLOGICAL SORT (DETERMINISTIC)
 * Stable sort that preserves original order when no dependency exists.
 */
export function sortIntentsByDependency(intents: any[]): any[] {
  const sorted: any[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(intentObj: any) {
    const intentName = intentObj.intent as AllowedIntent;
    
    if (visiting.has(intentName)) {
      // PHASE 6: CYCLE DETECTION
      throw new Error("Dependency cycle detected");
    }
    
    if (!visited.has(intentName)) {
      visiting.add(intentName);
      
      const deps = INTENT_DEPENDENCIES[intentName] || [];
      // Find dependent objects in the original list to maintain their objects
      for (const depName of deps) {
        const depObj = intents.find(i => i.intent === depName);
        if (depObj) {
          visit(depObj);
        }
      }
      
      visiting.delete(intentName);
      visited.add(intentName);
      sorted.push(intentObj);
    }
  }

  // To preserve original order (PHASE 4), we iterate in original order
  for (const intentObj of intents) {
    if (!visited.has(intentObj.intent)) {
      visit(intentObj);
    }
  }

  return sorted;
}
