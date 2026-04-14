export function createProvider(config) {
  return {
    async chat({ model, messages }) {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: model.id, messages })
      });
      const data = await res.json();
      return {
        content: data?.choices?.[0]?.message?.content || "",
        usage: data?.usage,
        timings: data?.timings
      };
    },

    async *streamChat({ model, messages }) {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          model: model.id, 
          messages,
          stream: true 
        })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.trim() || line.includes("[DONE]")) continue;
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.replace("data: ", ""));
              const content = data.choices?.[0]?.delta?.content || "";
              if (content) yield content;
            } catch (e) {}
          }
        }
      }
    }
  };
}
