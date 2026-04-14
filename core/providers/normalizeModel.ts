export function normalizeModel(provider: string, model: string) {
  return {
    provider,
    id: model,
    display: model
  };
}
