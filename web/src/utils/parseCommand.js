const KNOWN = new Set(["analyze", "find", "explain"]);

export function parseCommand(input) {
  if (!input.startsWith("/")) return { type: "chat", query: input };

  const [cmd, ...rest] = input.slice(1).split(" ");
  const query = rest.join(" ").trim();

  return KNOWN.has(cmd)
    ? { type: cmd, query }
    : { type: "chat", query: input };
}
