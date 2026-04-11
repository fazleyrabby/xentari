import { loadConfig } from "./config.js";
import { log } from "./logger.js";

export async function chat(messages, { maxTokens, temperature } = {}) {
  const config = loadConfig();
  const url = `${config.baseURL}/chat/completions`;
  const body = {
    model: config.model,
    messages,
    max_tokens: maxTokens ?? config.maxTokens,
    temperature: temperature ?? config.temperature,
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

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned empty response");
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
