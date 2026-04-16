export class ModelRegistry {
  constructor() {
    this.models = [];
    this.activeProviders = [];
    this.lastUpdated = null;
  }

  update(models, providers) {
    this.models = models;
    this.activeProviders = providers;
    this.lastUpdated = new Date();
  }

  getAll() {
    return this.models;
  }

  getByProvider(providerName) {
    return this.models.filter(m => m.provider === providerName);
  }

  getActiveProviders() {
    return this.activeProviders;
  }
}

export const modelRegistry = new ModelRegistry();
