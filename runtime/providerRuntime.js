import { loadConfig } from "../config/configManager.js";
import { ProviderRegistry } from "../core/providers/registry.js";
import { modelRegistry } from "../core/modelRegistry.js";

export class ProviderRuntime {
  constructor() {
    this.config = loadConfig();
    this.registry = new ProviderRegistry(this.config);
  }

  async refresh() {
    // 1. Detect active providers
    const activeProviders = await this.registry.detectActiveProviders();
    
    // 2. Fetch all models
    const allModels = await this.registry.getAllModels();
    
    // 3. Update central registry
    modelRegistry.update(allModels, activeProviders);

    return {
      providers: activeProviders,
      models: allModels
    };
  }
}

export const providerRuntime = new ProviderRuntime();
