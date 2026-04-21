import { AllowedIntent } from "../llamaParser.ts";

export interface ParsedMatch {
  intent: AllowedIntent;
  subject: string;
}

/**
 * PHASE 4 — REGEX PRE-PARSER (SUBJECT-AWARE)
 * Matches normalized input patterns and extracts the subject noun.
 */
export function preParser(input: string): ParsedMatch | null {
  let match;

  // Auth patterns
  if (/^add (auth|authentication|login)/.test(input)) {
    return { intent: "add_auth", subject: "auth" };
  }

  // Route patterns: "create product route", "add user route"
  if ((match = input.match(/^(?:create|add) (\w+) route/))) {
    return { intent: "create_route", subject: match[1] };
  }

  // Controller patterns: "create inventory controller", "add sales controller"
  if ((match = input.match(/^(?:create|add) (\w+) controller/))) {
    return { intent: "add_controller", subject: match[1] };
  }

  // Fallbacks for direct intents without specific nouns
  if (/^create route/.test(input)) {
    return { intent: "create_route", subject: "index" };
  }
  if (/^add controller/.test(input)) {
    return { intent: "add_controller", subject: "base" };
  }
  if (/^refactor/.test(input)) {
    return { intent: "refactor_structure", subject: "structure" };
  }

  return null;
}
