import { getContext } from "../context/contextEngine.js";
import { getRuntime } from "../runtime/context.js";

function validateModelConfig() {
  const { apiUrl, model } = getRuntime();

  if (!apiUrl && !model) return "NO_MODEL_FULL";
  if (!apiUrl) return "NO_API";
  if (!model) return "NO_MODEL";
  
  return "OK";
}

function getConfigErrorMessage(type) {
  switch (type) {
    case "NO_MODEL_FULL":
      return `⚠ No model configured.\n\nGo to settings and set:\n- API endpoint (e.g. http://localhost:11434)\n- Model name (e.g. llama3, qwen)\n\nThen try again.`;
    case "NO_API":
      return `⚠ No API endpoint configured.\n\nExample:\nhttp://localhost:11434 (Ollama)\nhttp://localhost:1234 (LM Studio)`;
    case "NO_MODEL":
      return `⚠ No model selected.\n\nExample:\n- llama3\n- qwen\n- mistral`;
    default:
      return "⚠ Unknown configuration error.";
  }
}

async function callModel(input, context) {
  const { apiUrl, model } = getRuntime();

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
  const configStatus = validateModelConfig();

  if (configStatus !== "OK") {
    return {
      type: "chat",
      message: getConfigErrorMessage(configStatus)
    };
  }

  const context = getContext();

  return {
    type: "chat",
    message: await callModel(input, context)
  };
}
