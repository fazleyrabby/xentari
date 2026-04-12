import { RetrievalContract } from "../types/index.ts";

export const CONTRACTS: Record<string, RetrievalContract> = {
  modify_function: {
    required: ["file", "functionBlock", "imports"],
    optional: ["dependencies"],
    maxTokens: 2000,
  },
  fix_bug: {
    required: ["file", "errorContext"],
    optional: ["related"],
    maxTokens: 2500,
  },
};
