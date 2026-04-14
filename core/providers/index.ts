export function createProvider(config) {
  return {
    async chat({ model, messages }) {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model.id,
          messages
        })
      });

      const data = await res.json();

      return {
        content: data?.choices?.[0]?.message?.content || "",
        usage: data?.usage,
        timings: data?.timings
      };
    }
  };
}
