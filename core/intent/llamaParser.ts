import { createProvider } from "../providers/index.js";
import { loadConfig } from "../config.js";
import { normalizeInput } from "./nl/normalizeInput.ts";
import { INTENT_SYNONYMS } from "./nl/synonyms.ts";
import { preParser } from "./nl/preParser.ts";
import { splitInstructions } from "./nl/splitInstructions.ts";
import { sortIntentsByDependency } from "./nl/dependencies.ts";

export type AllowedIntent = "add_auth" | "create_route" | "add_controller" | "refactor_structure";

export interface LlamaIntent {
  intent: AllowedIntent;
  target: string;
  scope: string;
  constraints: string[];
  subject: string;
}

export interface IntentError {
  error: string;
  failed_step?: string;
  allowed?: AllowedIntent[];
}

// Support for multi-step return format
export interface MultiStepIntentResponse {
  intents: LlamaIntent[];
  steps?: any[]; // For pipeline integration
  patches?: any[]; // For pipeline integration
}

const ALLOWED_INTENTS: AllowedIntent[] = ["add_auth", "create_route", "add_controller", "refactor_structure"];

// PHASE 7: DETERMINISTIC IR BUILD
const INTENT_MAPPING: Record<AllowedIntent, { target: string; scope: string }> = {
  "add_auth": { target: "Authentication", scope: "project" },
  "create_route": { target: "Route", scope: "module" },
  "add_controller": { target: "Controller", scope: "module" },
  "refactor_structure": { target: "Structure", scope: "project" }
};

export class LlamaParser {
  private provider: any;
  private config: any;

  constructor() {
    this.config = loadConfig();
    this.provider = createProvider(this.config);
  }

  /**
   * Main entry point for NL Compiler V4
   * Handles multi-step splitting, deduplication, and ordered execution.
   */
  async parse(input: string): Promise<MultiStepIntentResponse | IntentError> {
    // PHASE 2: DETERMINISTIC SPLITTING
    const rawSteps = splitInstructions(input);
    const intents: LlamaIntent[] = [];
    const seenIntents = new Set<string>();

    for (const rawStep of rawSteps) {
      const result = await this.parseSingle(rawStep);
      
      if ("error" in result) {
        // PHASE 5: FAILURE HANDLING (Reject entire instruction)
        return {
          error: "Invalid multi-step instruction",
          failed_step: rawStep
        };
      }

      // PHASE 6: INTENT DEDUPLICATION (Keep first occurrence per intent+subject)
      const key = `${result.intent}:${result.subject}`;
      if (!seenIntents.has(key)) {
        intents.push(result);
        seenIntents.add(key);
      }
    }

    // PHASE 5 (V4): FINAL EXECUTION ORDER (Dependency Aware)
    let sortedIntents: LlamaIntent[];
    try {
      sortedIntents = sortIntentsByDependency(intents);
    } catch (e: any) {
      return { error: e.message };
    }

    // PHASE 13: OUTPUT FORMAT
    return {
      intents: sortedIntents,
      steps: [], // Placeholder for pipeline
      patches: [] // Placeholder for pipeline
    };
  }

  /**
   * Internal pipeline for single-step parsing (NL Compiler V3)
   */
  private async parseSingle(input: string): Promise<LlamaIntent | IntentError> {
    // PHASE 1: INPUT NORMALIZATION
    const normalized = normalizeInput(input);

    // PHASE 2 & 3: SYNONYM MATCHING
    if (INTENT_SYNONYMS[normalized]) {
      return this.buildIR(INTENT_SYNONYMS[normalized], "base");
    }

    // PHASE 4: REGEX PRE-PARSER (Subject extraction)
    const regexMatch = preParser(normalized);
    if (regexMatch) {
      return this.buildIR(regexMatch.intent, regexMatch.subject);
    }

    // PHASE 5: LLM FALLBACK (LAST RESORT ONLY)
    return this.llmFallback(normalized);
  }

  private async llmFallback(input: string): Promise<LlamaIntent | IntentError> {
    const systemPrompt = `You are a strict intent classifier.
You MUST return ONLY valid JSON. No explanation.
Allowed intents: ${ALLOWED_INTENTS.join(", ")}

Classification Rules:
- If input mentions "auth", "login", "signup", "user", use "add_auth"
- If input mentions "route", "endpoint", "api", use "create_route"
- If input mentions "controller", "handler", use "add_controller"
- If input mentions "refactor", "cleanup", "move", "restructure", use "refactor_structure"
- If input does NOT fit one of the above strictly, return {}

JSON format:
{
  "intent": "...",
  "subject": "..."
}`;

    try {
      const result = await this.provider.chat({
        model: { id: this.config.model },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Classify this instruction: "${input}". Return JSON ONLY.` }
        ]
      });

      const rawContent = result.content.trim();
      return this.validateLLMOutput(rawContent);
    } catch (err: any) {
      return { error: "Invalid instruction" };
    }
  }

  private validateLLMOutput(rawJson: string): LlamaIntent | IntentError {
    try {
      const parsed = JSON.parse(rawJson);

      // PHASE 6: STRICT VALIDATION
      if (!parsed.intent || !ALLOWED_INTENTS.includes(parsed.intent as AllowedIntent)) {
        return { error: "Unsupported instruction", allowed: ALLOWED_INTENTS };
      }

      return this.buildIR(parsed.intent as AllowedIntent, parsed.subject || "base");
    } catch (e) {
      return { error: "Unsupported instruction", allowed: ALLOWED_INTENTS };
    }
  }

  private buildIR(intent: AllowedIntent, subject: string): LlamaIntent {
    const mapping = INTENT_MAPPING[intent];
    // PHASE 7: DETERMINISTIC IR BUILD
    return {
      intent,
      subject,
      target: mapping.target,
      scope: mapping.scope,
      constraints: []
    };
  }
}
