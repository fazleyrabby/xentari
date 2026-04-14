import { BaseProvider } from "./baseProvider.js";

export class LlamaProvider extends BaseProvider {
  constructor(config) {
    super("llama", config);
  }

  async detect() {
    if (!this.config?.enabled || !this.baseUrl) return false;
    const res = await this.safeFetch(`${this.baseUrl}/models`);
    this.isActive = !!res && res.ok;
    return this.isActive;
  }

  async listModels() {
    if (!this.isActive || !this.baseUrl) return [];
    
    // llama-server usually runs one model at a time, but supports OAI /models
    const res = await this.safeFetch(`${this.baseUrl}/models`);
    if (res && res.ok) {
      const data = await res.json();
      return (data.data || []).map(m => this.normalizeModel(m));
    }

    // Fallback: If OAI endpoint fails, llama-server is still active with one model
    return [{
      id: "qwen",
      name: "Qwen (llama-server)",
      provider: "llama"
    }];
  }

  normalizeModel(raw) {
    return {
      id: `llama:${raw.id}`,
      name: raw.id.split("/").pop(),
      provider: "llama"
    };
  }
}
