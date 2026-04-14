import { loadConfig } from "../config/loadConfig.ts";
import { normalizeModel } from "../providers/normalizeModel.ts";
import { createProvider } from "../providers/index.ts";
import { loadSession, saveSession } from "../session/store.ts";
import { buildContext, scoreFile } from "../context/buildContext.ts";
import { detectProject } from "../context/projectIntelligence.ts";
import { createKey, getCache, setCache } from "../context/contextCache.ts";
import crypto from "crypto";

export async function runAgent({ input, projectDir, sessionId = "default", onChunk = null, onStatus = null, onContext = null, meta = null }: { input: string; projectDir: string; sessionId?: string; onChunk?: ((chunk: string) => void) | null; onStatus?: ((msg: string) => void) | null; onContext?: ((files: unknown[]) => void) | null; meta?: { command?: string } | null }) {
  const config = loadConfig(projectDir);
  const model = normalizeModel(config.provider, config.model);
  const provider = createProvider(config);
  const history = loadSession(projectDir, sessionId);

  if (onStatus) onStatus("scanning project");
  const dirHash = crypto.createHash("md5").update(projectDir).digest("hex");
  const cacheKey = createKey(input, dirHash);
  const cached = getCache(cacheKey);
  const context = cached ?? (() => {
    const built = buildContext(projectDir);
    setCache(cacheKey, built);
    return built;
  })();

  if (onContext && context.files) {
    const contextFiles = context.files.map((f, i) => ({
      path: f.path || f, // handle string array fallback
      score: f.score ?? (context.files.length - i) // fallback ranking
    }));
    onContext(contextFiles);
  }
  
  const project = await detectProject({ files: context.structure, provider, projectDir, model });

  if (onStatus) onStatus("analyzing context");

  const rankedSnippets = (context.snippets ?? [])
    .map(f => ({ ...f, score: scoreFile(f, input, project) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const projectLabel = [project.framework, project.type].filter(Boolean).join(" ");
  const mode = meta?.command || "chat";
  const systemPrompt = `You are Xentari AI analyzing a ${projectLabel || "software"} project.

Mode: ${mode}

Guidelines:
- Follow the mode strictly.
- Focus on core architecture (backend, routing, services, domain logic).
- Treat build tools (vite, webpack, assets) as secondary unless explicitly asked.
- Prioritize directories that define application behavior over static assets.
- Base your answer strictly on the provided context.
- If information is not explicitly present in the context, say "not found in context". Do not guess or fabricate implementations.

PROJECT STRUCTURE:
${context.structure.slice(0, 60).join("\n")}

TOP CONTEXT FILES:
${JSON.stringify(rankedSnippets, null, 2)}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: input }
  ];

  if (onChunk) {
    if (onStatus) onStatus("generating response");
    let fullContent = "";
    const stream = provider.streamChat({ model, messages });
    for await (const chunk of stream) {
      fullContent += chunk;
      onChunk(chunk);
    }
    
    // Finalize session
    const updated = [
      ...history,
      { role: "user", content: input },
      { role: "assistant", content: fullContent }
    ];
    saveSession(projectDir, sessionId, updated);

    return { fullText: fullContent };
  } else {
    const result = await provider.chat({ model, messages });
    const reply = result.content;

    const updated = [
      ...history,
      { role: "user", content: input },
      { role: "assistant", content: reply }
    ];
    saveSession(projectDir, sessionId, updated);

    return {
      message: reply,
      model,
      usage: result.usage
    };
  }
}
