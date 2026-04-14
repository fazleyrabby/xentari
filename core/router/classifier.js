export function classifyInput(input) {
  const lower = input.toLowerCase();

  const systemTriggers = [
    "status",
    "files",
    "what happened",
    "trace",
    "stack"
  ];

  if (systemTriggers.some(k => lower.includes(k))) {
    return "SYSTEM";
  }

  const execTriggers = [
    "create",
    "build",
    "run",
    "generate"
  ];

  if (execTriggers.some(k => lower.includes(k))) {
    return "EXEC";
  }

  return "CHAT";
}
