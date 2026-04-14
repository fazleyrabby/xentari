import { getContext } from "../context/contextEngine.js";
import { getRuntime } from "../runtime/context.js";

async function callModel(input, context) {
  const { apiUrl, model } = getRuntime();

  if (!apiUrl) {
    return "⚠ No model configured. Please set API URL and Model in Settings.";
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt: `
You are Xentari, an AI coding agent. Use the context below to help the user.
Be concise and deterministic.

CONTEXT:
${JSON.stringify(context, null, 2)}

USER:
${input}

ASSISTANT:
        `
      })
    });

    const data = await res.json();

    // Support both Ollama and standard OpenAI-like response formats
    return data.response || data.choices?.[0]?.message?.content || data.output || "No response content received.";
  } catch (e) {
    return `❌ Model request failed: ${e.message}`;
  }
}

export async function handleChat(input) {
  const context = getContext();

  return {
    type: "chat",
    message: await callModel(input, context)
  };
}
