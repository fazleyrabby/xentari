import fs from "fs";

export function buildContext({ filePath, functionName }) {
  const content = fs.readFileSync(filePath, "utf-8");

  return {
    file: content,
    functionBlock: functionName
      ? extractFunction(content, functionName)
      : null,
    imports: extractImports(content),
  };
}

function extractFunction(code, fnName) {
  const regex = new RegExp(
    `function\\s+${fnName}\\s*\\([^)]*\\)\\s*{[\\s\\S]*?}`,
    "m"
  );
  return code.match(regex)?.[0] || null;
}

function extractImports(code) {
  return code
    .split("\n")
    .filter((l) => l.startsWith("import") || l.startsWith("use"));
}
