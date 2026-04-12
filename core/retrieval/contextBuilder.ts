import fs from "fs";
import { Context } from "../types/index.ts";

export function buildContext({ filePath, functionName }: { filePath: string; functionName?: string }): Context {
  const content = fs.readFileSync(filePath, "utf-8");

  return {
    file: content,
    functionBlock: functionName
      ? extractFunction(content, functionName)
      : null,
    imports: extractImports(content),
  };
}

function extractFunction(code: string, fnName: string): string | null {
  const regex = new RegExp(
    `function\\s+${fnName}\\s*\\([^)]*\\)\\s*{[\\s\\S]*?}`,
    "m"
  );
  return code.match(regex)?.[0] || null;
}

function extractImports(code: string): string[] {
  return code
    .split("\n")
    .filter((l: string) => l.startsWith("import") || l.startsWith("use"));
}
