import { loadConfig } from "../config/configManager.js";
import { ProviderRegistry } from "../core/providers/registry.js";
import { modelRegistry } from "../core/modelRegistry.js";
import { mergeModels } from "../core/models/modelMerger.js";

export class ProviderRuntime {
  constructor() {
    this.config = loadConfig();
    this.registry = new ProviderRegistry(this.config);
  }

  async refresh() {
    this.config = loadConfig();
    this.registry = new ProviderRegistry(this.config);

    // 1. Detect active providers
    const activeProviders = await this.registry.detectActiveProviders();
    
    // 2. Fetch all models from providers
    const detectedModels = await this.registry.getAllModels();
    
    // 3. Merge with config overrides
    const finalModels = mergeModels(detectedModels, this.config);

    // 4. Update central registry
    modelRegistry.update(finalModels, activeProviders);

    return {
      providers: activeProviders,
      models: finalModels
    };
  }
}

export const providerRuntime = new ProviderRuntime();
