export function classifyInput(input) {
  const execKeywords = [
    "create",
    "build",
    "generate",
    "run",
    "make",
    "setup"
  ];

  const lower = input.toLowerCase();

  const isExec = execKeywords.some(k => lower.includes(k));

  return isExec ? "EXEC" : "CHAT";
}
