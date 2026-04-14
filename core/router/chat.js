import { getContext } from "../context/contextEngine.js";

export async function handleChat(input) {
  const context = getContext();

  const lower = input.toLowerCase();

  // Basic smart responses (no LLM yet)
  if (lower.includes("files")) {
    return {
      type: "chat",
      message: `📁 Project files:\n${context.files.map(f => f.name).join(", ")}`
    };
  }

  if (lower.includes("status")) {
    return {
      type: "chat",
      message: `📊 Status: ${context.phase} (${context.mode})`
    };
  }

  if (lower.includes("what happened")) {
    return {
      type: "chat",
      message: `🧠 Recent activity:\n${context.trace.map(t => `[${t.type}] ${t.command || t.reason || ""}`).join("\n")}`
    };
  }

  return {
    type: "chat",
    message: `🤖 Xentari understands your project. Ask about files, status, or actions.`
  };
}
