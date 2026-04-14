export function loadConfig(projectDir: string) {
  return {
    provider: "llama",
    baseUrl: "http://localhost:8081/v1",
    model: "qwen2.5-coder-7b-instruct-q4_k_m.gguf"
  };
}
