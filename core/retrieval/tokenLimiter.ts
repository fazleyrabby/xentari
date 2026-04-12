import { Context } from "../types/index.ts";

export function trimContext(context: Context, maxTokens: number): Context {
  const str = JSON.stringify(context);

  if (str.length <= maxTokens) return context;

  if (context.functionBlock) {
    return { functionBlock: context.functionBlock };
  }

  return { file: (context.file || "").slice(0, maxTokens) };
}
