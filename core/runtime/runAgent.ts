import { loadConfig } from "../config/loadConfig.ts";
import { normalizeModel } from "../providers/normalizeModel.ts";
import { createProvider } from "../providers/index.ts";
import { loadSession, saveSession } from "../session/store.ts";
import { buildContext, scoreFile } from "../context/buildContext.ts";
import { optimizeContext } from "../context/optimizeContext.ts";
import { detectProject } from "../context/projectIntelligence.ts";
import { createKey, getCache, setCache } from "../context/contextCache.ts";
import { normalizeMetrics } from "../llm/metrics.js";
import { detectModel } from "../utils/detectModel.ts";
import { buildPromptWithBudget, estimateTokens } from "./contextBudget.ts";
import crypto from "crypto";

function sanitizeOutput(text: string) {
  return text
    .replace(/I (cannot|can't) access files/gi, 'Using available context')
    .replace(/I am not able to analyze/gi, 'Based on the provided context');
}

export async function runAgent({ input, projectDir, sessionId = "default", onChunk = null, onStatus = null, onContext = null, onMetrics = null, onIntelligence = null, meta = null }: { input: string; projectDir: string; sessionId?: string; onChunk?: ((chunk: string) => void) | null; onStatus?: ((msg: string) => void) | null; onContext?: ((files: unknown[]) => void) | null; onMetrics?: ((m: any) => void) | null; onIntelligence?: ((intel: any) => void) | null; meta?: { command?: string } | null }) {
  const perf: any = { start: Date.now() };
  
  if (!projectDir) {
    throw new Error("projectDir is required");
  }

  console.log("[XENTARI] ACTIVE PROJECT:", projectDir);

  const config = loadConfig(projectDir);
  const model = normalizeModel(config.provider, config.model);
  const provider = createProvider(config);
  const history = loadSession(projectDir, sessionId);
  const modelName = detectModel();

  if (onStatus) onStatus("scanning project");
  const dirHash = crypto.createHash("md5").update(projectDir).digest("hex");
  const cacheKey = createKey(input, dirHash);
  let context = getCache(cacheKey);
  
  if (!context || !context.snippets || context.snippets.length === 0) {
    context = buildContext(projectDir);
    setCache(cacheKey, context);
  }
  perf.scan = Date.now() - perf.start;

  if (onContext && context.files) {
    const contextFiles = context.files.map((f, i) => ({
      path: f.path || f, 
      score: f.score ?? (context.files.length - i) 
    }));
    onContext(contextFiles);
  }
  
  const intelligence = await detectProject({ files: context.structure, projectDir });
  if (onIntelligence) onIntelligence(intelligence);

  if (onStatus) onStatus("analyzing context");
  
  const scoredSnippets = (context.snippets ?? [])
    .map(f => {
      const result = scoreFile(f, input, intelligence);
      return { ...f, score: result.score, steps: result.steps };
    });

  const rankedSnippets = optimizeContext(scoredSnippets, input)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 15); // candidate pool for budget

  perf.analysis = Date.now() - perf.start - perf.scan;

  const isLowSignal = !rankedSnippets.some(s => s.score > 5);
  if (isLowSignal) {
    console.warn('[XENTARI] LOW_SIGNAL detected');
  }
const mode = meta?.command || "chat";
const isCodeMode = mode === "code" || input.toLowerCase().includes("modify") || input.toLowerCase().includes("fix") || input.toLowerCase().includes("add");

const systemPrompt = `You are Xentari — a deterministic AI coding system.

Execution Context:
- You are running locally inside a development environment
- You have access to a project directory
- You are given relevant files and extracted context from that project

Capabilities:
- You CAN analyze the project structure
- You CAN reason about files and architecture
- You CAN explain dependencies and relationships

Rules:
- NEVER say "I can't access files"
- NEVER say "I can't analyze the project"
- NEVER use words like "likely", "probably", "typically", "usually"
- NEVER behave like a general chatbot
- NEVER mention OpenAI, GPT-4, or external providers

${isCodeMode ? `Code Modification Mode:
- When proposing code changes, you MUST return ONLY a JSON object in this format:
{
"text": "Brief explanation of changes",
"changes": [
  {
    "file": "relative/path/to/file.js",
    "action": "modify", 
    "content": "FULL new content of the file"
  }
]
}
- Do NOT wrap the JSON in markdown blocks.
- Do NOT include any text outside the JSON object.` : `Strict Ground Truth:
- Base your answers ONLY on the provided context
- If information is missing → say: "This is not present in the current context"`}
${isLowSignal ? '- WARNING: The current query has low semantic signal. Acknowledge limited context in your response.' : ''}

---

Project Intelligence (deterministic):
Primary: ${intelligence.primary}
Confidence: ${intelligence.confidence}

---

TOP CONTEXT CONTENT:
\${contextText}`;

  // Build prompt with dynamic budget
  const budget = buildPromptWithBudget({
    systemPrompt: baseSystemPrompt,
    userQuery: input,
    files: rankedSnippets,
    history: history,
    maxTokens: 8192,
    reservedForOutput: 1024
  });

  const messages = budget.messages;

  console.log('[XENTARI] BUDGET:', {
    total: budget.tokens.total,
    limit: budget.limit,
    trimmed: budget.trimmed,
    files: budget.tokens.files,
    finalHistory: messages.length - 2 
  });

  if (onChunk) {
    if (onStatus) onStatus("generating response");
    let fullContent = "";
    let firstTokenTime = 0;
    const stream = provider.streamChat({ model, messages });
    let finalUsage = null;

    for await (const data of stream) {
      if (data.type === "chunk") {
        if (!firstTokenTime) firstTokenTime = Date.now();
        fullContent += data.content;
        onChunk(data.content);
      } else if (data.type === "usage") {
        finalUsage = data.usage;
      }
    }

    const end = Date.now();
    const latency = end - perf.start;
    const ttf = firstTokenTime ? (firstTokenTime - perf.start) : latency;

    // Estimate tokens
    const usage = finalUsage || {
      prompt_tokens: budget.tokens.total,
      completion_tokens: estimateTokens(fullContent),
    };

    const metrics = normalizeMetrics({
      ...usage,
      latency,
      ttf,
      tokens_per_second: (usage.completion_tokens) / (Math.max(1, end - firstTokenTime) / 1000),
      provider: config.provider || "local",
      perf
    });

    if (onMetrics) onMetrics(metrics);
    
    const sanitizedContent = sanitizeOutput(fullContent);

    // Finalize session
    const updated = [
      ...history,
      { role: "user", content: input },
      { role: "assistant", content: sanitizedContent }
    ];
    saveSession(projectDir, sessionId, updated);

    return { fullText: sanitizedContent, metrics, budget };
  } else {
    const startTime = Date.now();
    const result = await provider.chat({ model, messages });
    const end = Date.now();
    const latency = end - perf.start;
    const reply = sanitizeOutput(result.content);
    
    // Estimate tokens
    const usage = result.usage || {
      prompt_tokens: budget.tokens.total,
      completion_tokens: estimateTokens(reply),
    };

    const metrics = normalizeMetrics({
      ...usage,
      latency,
      tokens_per_second: (usage.completion_tokens) / (Math.max(1, end - startTime) / 1000),
      provider: config.provider || "local",
      perf
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
      metrics,
      budget
    };
  }
}
