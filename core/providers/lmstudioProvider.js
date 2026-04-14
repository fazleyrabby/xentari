import { BaseProvider } from "./baseProvider.js";

export class LMStudioProvider extends BaseProvider {
  constructor(config) {
    super("lmstudio", config);
  }

  async detect() {
    if (!this.config?.enabled || !this.baseUrl) return false;
    const res = await this.safeFetch(`${this.baseUrl}/models`);
    this.isActive = !!res && res.ok;
    return this.isActive;
  }

  async listModels() {
    if (!this.isActive || !this.baseUrl) return [];
    
    const res = await this.safeFetch(`${this.baseUrl}/models`);
    if (!res || !res.ok) return [];

    const data = await res.json();
    return (data.data || []).map(m => this.normalizeModel(m));
  }

  normalizeModel(raw) {
    return {
      id: `lmstudio:${raw.id}`,
      name: raw.id.split("/").pop(),
      provider: "lmstudio",
      context: raw.context_length || null
    };
  }
}
