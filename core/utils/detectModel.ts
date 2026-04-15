export function detectModel() {
  // Priority order

  // 1. Env override (explicitly set)
  if (process.env.MODEL_NAME) {
    return process.env.MODEL_NAME;
  }

  // 2. llama.cpp / local path (often used in local setups)
  if (process.env.MODEL_PATH) {
    const name = process.env.MODEL_PATH.split('/').pop();
    if (name) return name.replace('.gguf', '');
  }

  // 3. Known local provider defaults (simplified)
  // If we're using Ollama, we might not know without a fetch, 
  // but we can at least provide a generic label if no specific env is set.
  return 'local-model';
}
