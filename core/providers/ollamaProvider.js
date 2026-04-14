import { BaseProvider } from "./baseProvider.js";

export class OllamaProvider extends BaseProvider {
  constructor(config) {
    super("ollama", config);
  }

  async detect() {
    if (!this.config?.enabled) return false;
    const res = await this.safeFetch(`${this.config.baseUrl}/api/tags`);
    this.isActive = !!res && res.ok;
    return this.isActive;
  }

  async listModels() {
    if (!this.isActive) return [];
    
    const res = await this.safeFetch(`${this.config.baseUrl}/api/tags`);
    if (!res || !res.ok) return [];

    const data = await res.json();
    return (data.models || []).map(m => this.normalizeModel(m));
  }

  normalizeModel(raw) {
    return {
      id: raw.name,
      name: raw.name.split(":")[0],
      provider: "ollama",
      details: raw.details || {},
      size: raw.size
    };
  }
}
