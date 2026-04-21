import { AllowedIntent } from "../llamaParser.ts";

/**
 * PHASE 2 — SYNONYM MAP (PRIMARY PATH)
 * Maps exact normalized phrases to intents.
 */
export const INTENT_SYNONYMS: Record<string, AllowedIntent> = {
  "add authentication": "add_auth",
  "add login": "add_auth",
  "implement auth": "add_auth",
  "create auth": "add_auth",
  "add auth": "add_auth",
  "create route": "create_route",
  "add route": "create_route",
  "add controller": "add_controller",
  "create controller": "add_controller",
  "refactor": "refactor_structure",
  "clean structure": "refactor_structure",
  "refactor structure": "refactor_structure"
};
