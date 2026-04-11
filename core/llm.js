import { loadConfig } from "./config.js";
import { log } from "./logger.js";

function estimateTokens(str) {
  if (!str) return 0;
  return Math.ceil(str.length / 4);
}

export async function chat(messages, { maxTokens, temperature, stream = false, onToken, metrics } = {}) {
  const config = loadConfig();
  const url = `${config.baseURL}/chat/completions`;
  
  // Track input tokens
  if (metrics) {
    const promptText = messages.map(m => m.content).join("\n");
    metrics.inputTokens += estimateTokens(promptText);
  }

  const body = {
    model: config.model,
    messages,
    max_tokens: maxTokens ?? config.maxTokens,
    temperature: temperature ?? config.temperature,
    stream,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.llmTimeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      throw new Error(`LLM ${res.status}: ${text}`);
    }

    if (stream) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(l => l.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") break;
            try {
              const data = JSON.parse(dataStr);
              const token = data.choices?.[0]?.delta?.content || "";
              if (token) {
                fullContent += token;
                if (onToken) onToken(token);
              }
            } catch (e) {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }

      if (metrics) {
        metrics.outputTokens += estimateTokens(fullContent);
        metrics.tokens = metrics.inputTokens + metrics.outputTokens;
      }

      return fullContent.trim();
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned empty response");

    if (metrics) {
      metrics.outputTokens += estimateTokens(content);
      metrics.tokens = metrics.inputTokens + metrics.outputTokens;
    }

    return content.trim();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`LLM timed out after ${config.llmTimeoutMs / 1000}s`);
    }
    if (err.cause?.code === "ECONNREFUSED") {
      throw new Error(`Cannot reach LLM server at ${config.baseURL} — is llama.cpp running?`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
