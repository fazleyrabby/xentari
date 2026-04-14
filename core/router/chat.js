import { getContext } from "../context/contextEngine.js";
import { getRuntime } from "../runtime/context.js";
import { normalizeBaseUrl } from "../providers/normalizeBaseUrl.js";

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
      return `⚠ Unable to reach model API\n→ Check base URL: http://localhost:8081/v1\n→ Ensure server is running`;
    case "NO_API":
      return `⚠ No API endpoint configured.\n\nExample:\nhttp://localhost:11434 (Ollama)\nhttp://localhost:1234/v1 (LM Studio)`;
    case "NO_MODEL":
      return `⚠ No model selected.\n\nExamples: llama3, qwen, ollama:qwen`;
    default:
      return "⚠ Unknown configuration error.";
  }
}

async function callModel(input, context) {
  let { apiUrl, model } = getRuntime();

  if (!apiUrl) return "❌ No API URL configured.";

  // Normalize API URL
  let endpoint = normalizeBaseUrl(apiUrl);
  if (endpoint) {
    endpoint = endpoint + "/chat/completions";
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are Xentari, an AI coding agent. Use the context provided to help the user.
Be concise, deterministic, and helpful.

CONTEXT:
${JSON.stringify(context, null, 2)}`
          },
          {
            role: "user",
            content: input
          }
        ],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const errBody = await res.text();
      return `❌ Model error (${res.status}): ${errBody.slice(0, 100)}`;
    }

    const data = await res.json();

    const content = data.choices?.[0]?.message?.content || 
                    data.message?.content || 
                    data.response || 
                    data.output || 
                    "No response content received.";
                    
    return content;
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
