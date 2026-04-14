export function mergeModels(runtimeModels, config) {
  const final = [];
  const configModels = config.models || {};
  const defaultId = config.defaultModel;

  for (const model of runtimeModels) {
    const key = model.id; // e.g., "ollama:qwen:latest"
    const override = configModels[key];

    let merged = { ...model };

    if (override) {
      merged = {
        ...merged,
        ...override,
        overridden: true
      };
    }

    // Mark as selected if it's the default
    merged.selected = (merged.id === defaultId);

    final.push(merged);
  }

  return final;
}
