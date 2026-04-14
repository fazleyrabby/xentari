import { normalizeBaseUrl } from "./normalizeBaseUrl.js";

export class BaseProvider {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.isActive = false;
  }

  get baseUrl() {
    return normalizeBaseUrl(this.config?.baseUrl, this.name);
  }

  async detect() {
    throw new Error("detect() not implemented");
  }

  async listModels() {
    throw new Error("listModels() not implemented");
  }

  normalizeModel(raw) {
    throw new Error("normalizeModel() not implemented");
  }

  async streamChat({ model, messages, onToken }) {
    if (!this.baseUrl) throw new Error("Provider base URL not configured");

    const endpoint = `${this.baseUrl}/chat/completions`;
    const actualModel = model?.includes(":") ? model.split(":").pop() : model;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: actualModel,
        messages,
        stream: true
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Stream request failed (${res.status}): ${err}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let fullText = "";
    let tokenCount = 0;
    const start = Date.now();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const jsonStr = trimmed.replace("data:", "").trim();
          if (jsonStr === "[DONE]") break;

          try {
            const data = JSON.parse(jsonStr);
            const token = data?.choices?.[0]?.delta?.content || "";

            if (token) {
              fullText += token;
              tokenCount++;

              const elapsed = (Date.now() - start) / 1000;

              onToken({
                token,
                fullText,
                tokens: tokenCount,
                tps: tokenCount / elapsed,
                latency: Date.now() - start
              });
            }
          } catch (e) {
            // Ignore parse errors from partial chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  async safeFetch(url, options = {}) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout for detection
      
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      
      return res;
    } catch (e) {
      return null;
    }
  }
}
