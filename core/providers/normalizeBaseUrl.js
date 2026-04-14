export function normalizeBaseUrl(input, providerType = "openai") {
  if (!input) return null;

  let url = input.trim().replace(/\/+$/, "");

  if (providerType === "ollama") {
    // Ollama remains as is for /api/tags
    return url;
  }

  // OpenAI-compatible cleanup
  // ❌ Remove full endpoint if user pasted it
  url = url.replace(/\/v1\/chat\/completions$/, "");
  url = url.replace(/\/chat\/completions$/, "");
  url = url.replace(/\/v1\/models$/, "");
  url = url.replace(/\/models$/, "");

  // ✅ Ensure /v1 exists for OpenAI-compatible APIs
  if (!url.endsWith("/v1")) {
    url += "/v1";
  }

  return url;
}
