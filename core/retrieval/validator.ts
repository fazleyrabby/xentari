import { Context, RetrievalContract, RetrievalValidationResult } from "../types/index.ts";

export function validateContext(context: Context, contract: RetrievalContract): RetrievalValidationResult {
  const missing = [];

  for (const field of contract.required) {
    if (!context[field]) missing.push(field);
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
