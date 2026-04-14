import { BaseProvider } from "./baseProvider.js";

export class OllamaProvider extends BaseProvider {
  constructor(config) {
    super("ollama", config);
  }

  async detect() {
    if (!this.config?.enabled || !this.baseUrl) return false;
    const res = await this.safeFetch(`${this.baseUrl}/api/tags`);
    this.isActive = !!res && res.ok;
    return this.isActive;
  }

  async listModels() {
    if (!this.isActive || !this.baseUrl) return [];
    
    const res = await this.safeFetch(`${this.baseUrl}/api/tags`);
    if (!res || !res.ok) return [];

    const data = await res.json();
    return (data.models || []).map(m => this.normalizeModel(m));
  }

  normalizeModel(raw) {
    return {
      id: `ollama:${raw.name}`,
      name: raw.name,
      provider: "ollama",
      details: raw.details || {},
      size: raw.size
    };
  }
}
