import { OllamaProvider } from "./ollamaProvider.js";
import { LMStudioProvider } from "./lmstudioProvider.js";

export class ProviderRegistry {
  constructor(config = {}) {
    this.providers = [
      new OllamaProvider(config.providers?.ollama),
      new LMStudioProvider(config.providers?.lmstudio)
    ];
  }

  async detectActiveProviders() {
    await Promise.all(this.providers.map(p => p.detect()));
    return this.providers.filter(p => p.isActive).map(p => p.name);
  }

  async getAllModels() {
    const modelSets = await Promise.all(
      this.providers.map(p => p.listModels())
    );
    return modelSets.flat();
  }
}
