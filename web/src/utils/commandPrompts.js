export function getCommandPrompt(type, query) {
  switch (type) {
    case "analyze":
      return `You are analyzing a codebase.\n\nGoal:\n- Explain architecture and flow\n- Identify key components\n- Be concise and structured\n\nUser query:\n${query}`;
    case "find":
      return `You are locating relevant code.\n\nGoal:\n- Identify exact files and functions\n- Explain why they are relevant\n- Do NOT generalize\n\nUser query:\n${query}`;
    case "explain":
      return `You are explaining code.\n\nGoal:\n- Explain clearly\n- Reference specific lines/files\n- Avoid assumptions\n\nUser query:\n${query}`;
    default:
      return query;
  }
}
