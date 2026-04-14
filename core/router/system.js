import { getContext } from "../context/contextEngine.js";

export function handleSystem(input) {
  const ctx = getContext();
  const lower = input.toLowerCase();

  if (lower.includes("status")) {
    return `📊 Status: ${ctx.phase || "unknown"}`;
  }

  if (lower.includes("files")) {
    return `📁 Files: ${ctx.files.map(f => f.name).join(", ")}`;
  }

  if (lower.includes("what happened") || lower.includes("trace")) {
    return ctx.trace?.length 
      ? ctx.trace.map(t => `[${t.type}] ${t.command || t.reason || ""}`).join("\n") 
      : "No trace history available";
  }

  if (lower.includes("stack")) {
    return `📚 Stack: ${ctx.stack || "none"}`;
  }

  return "System info not available";
}
