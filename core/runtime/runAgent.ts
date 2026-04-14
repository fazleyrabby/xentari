import { loadConfig } from "../config/loadConfig.ts";
import { normalizeModel } from "../providers/normalizeModel.ts";
import { createProvider } from "../providers/index.ts";
import { loadSession, saveSession } from "../session/store.ts";
import { buildContext, scoreFile } from "../context/buildContext.ts";
import { optimizeContext } from "../context/optimizeContext.ts";
import { detectProject } from "../context/projectIntelligence.ts";
import { createKey, getCache, setCache } from "../context/contextCache.ts";
import { normalizeMetrics } from "../llm/metrics.js";
import crypto from "crypto";

export async function runAgent({ input, projectDir, sessionId = "default", onChunk = null, onStatus = null, onContext = null, onMetrics = null, meta = null }: { input: string; projectDir: string; sessionId?: string; onChunk?: ((chunk: string) => void) | null; onStatus?: ((msg: string) => void) | null; onContext?: ((files: unknown[]) => void) | null; onMetrics?: ((m: any) => void) | null; meta?: { command?: string } | null }) {
  if (!projectDir) {
    throw new Error("projectDir is required");
  }

  console.log("[XENTARI] ACTIVE PROJECT:", projectDir);

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

  const scoredSnippets = (context.snippets ?? [])
    .map(f => ({ ...f, score: scoreFile(f, input, project) }));

  const rankedSnippets = optimizeContext(scoredSnippets, input)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
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
    const startTime = Date.now();
    const stream = provider.streamChat({ model, messages });
    let finalUsage = null;

    for await (const data of stream) {
      if (data.type === "chunk") {
        fullContent += data.content;
        onChunk(data.content);
      } else if (data.type === "usage") {
        finalUsage = data.usage;
      }
    }

    const latency = Date.now() - startTime;
    // Estimate tokens if usage is missing (fallback: 1 token ~= 4 chars)
    const usage = finalUsage || {
      prompt_tokens: Math.ceil((JSON.stringify(messages).length) / 4),
      completion_tokens: Math.ceil(fullContent.length / 4),
    };

    const metrics = normalizeMetrics({
      ...usage,
      latency,
      tokens_per_second: (usage.completion_tokens || (fullContent.length / 4)) / (latency / 1000),
      provider: config.provider || "local"
    });

    if (onMetrics) onMetrics(metrics);
    
    // Finalize session
    const updated = [
      ...history,
      { role: "user", content: input },
      { role: "assistant", content: fullContent }
    ];
    saveSession(projectDir, sessionId, updated);

    return { fullText: fullContent, metrics };
  } else {
    const startTime = Date.now();
    const result = await provider.chat({ model, messages });
    const latency = Date.now() - startTime;
    const reply = result.content;
    
    const metrics = normalizeMetrics({
      ...result.usage,
      latency,
      tokens_per_second: (result.usage?.completion_tokens || (reply.length / 4)) / (latency / 1000),
      provider: config.provider || "local"
    });

    if (onMetrics) onMetrics(metrics);

    const updated = [
      ...history,
      { role: "user", content: input },
      { role: "assistant", content: reply }
    ];
    saveSession(projectDir, sessionId, updated);

    return {
      message: reply,
      model,
      metrics
    };
  }
}
