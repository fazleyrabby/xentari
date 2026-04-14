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
