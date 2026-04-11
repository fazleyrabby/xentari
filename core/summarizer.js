import { chat } from "./llm.js";

export async function summarizePatch(patch, { metrics } = {}) {
  const messages = [
    {
      role: "system",
      content: "Summarize this diff in one short sentence (under 80 chars). Describe what was changed. No preamble.",
    },
    { role: "user", content: patch },
  ];

  try {
    return await chat(messages, { maxTokens: 60, metrics });
  } catch {
    // Fallback: extract file names from patch
    const files = [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]);
    return files.length ? `Modified ${files.join(", ")}` : "Applied changes";
  }
}
