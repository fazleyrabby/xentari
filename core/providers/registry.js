import { OllamaProvider } from "./ollamaProvider.js";
import { LMStudioProvider } from "./lmstudioProvider.js";
import { LlamaProvider } from "./llamaProvider.js";

export class ProviderRegistry {
  constructor(config = {}) {
    this.providers = [
      new OllamaProvider(config.providers?.ollama),
      new LMStudioProvider(config.providers?.lmstudio),
      new LlamaProvider(config.providers?.llama)
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

export function getProvider(name) {
  const apiUrl = "http://localhost:11434"; // Legacy fallback
  const registry = new ProviderRegistry({
    providers: {
      ollama: { enabled: true, baseUrl: apiUrl },
      lmstudio: { enabled: true, baseUrl: apiUrl },
      llama: { enabled: true, baseUrl: apiUrl }
    }
  });

  return registry.providers.find(provider => provider.name === name);
}
