import { loadConfig } from "../config/loadConfig.ts";
import { normalizeModel } from "../providers/normalizeModel.ts";
import { createProvider } from "../providers/index.ts";
import { loadSession, saveSession } from "../session/store.ts";
import { buildContext, scoreFile } from "../context/buildContext.ts";
import { optimizeContext } from "../context/optimizeContext.ts";
import { detectProject } from "../context/projectIntelligence.ts";
import { normalizeMetrics } from "../llm/metrics.js";
import { detectModel } from "../utils/detectModel.ts";
import { buildPromptWithBudget, estimateTokens } from "./contextBudget.ts";
import { execSync } from "child_process";
import path from "path";
import { ProjectIR } from "../types/ir.ts";

function sanitizeOutput(text: string) {
  return text
    .replace(/I (cannot|can't) access files/gi, 'Using available context')
    .replace(/I am not able to analyze/gi, 'Based on the provided context');
}

/**
 * Output Adapter: Converts rich IR to deterministic Xentari format
 */
function irToXentariFormat(projectIR: ProjectIR): string {
  const lines: string[] = [];

  // 1. Sort by file path
  const sortedFiles = [...projectIR].sort((a, b) => a.file.localeCompare(b.file));

  for (const fileIR of sortedFiles) {
    // 2. Sort entities: class first, then by name, then by line
    const sortedEntities = [...fileIR.entities].sort((a, b) => {
      if (a.type !== b.type) {
        if (a.type === 'class') return -1;
        if (b.type === 'class') return 1;
      }
      const nameA = a.name || 'anonymous';
      const nameB = b.name || 'anonymous';
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return a.location.start.line - b.location.start.line;
    });

    for (const entity of sortedEntities) {
      const name = entity.name || 'anonymous';
      const symbol = entity.type === 'class' ? `class ${name}` : `${name}()`;
      const fact = entity.type === 'class' ? 'defines class' : `returns ${entity.returns.relation || entity.returns.kind}`;
      lines.push(`${fileIR.file} → ${symbol} → ${fact}`);
    }

    for (const error of fileIR.errors) {
      lines.push(`${fileIR.file} → error → ${error.message} (line ${error.location.line})`);
    }
  }

  return lines.join("\n").toLowerCase();
}

/**
 * Validates IR Integrity
 */
function validateIR(projectIR: ProjectIR) {
  const ids = new Set<string>();
  for (const file of projectIR) {
    for (const entity of file.entities) {
      // Allow empty name for classes (anonymous classes)
      if (!entity.id || !entity.type || !entity.location) {
        throw new Error(`Invalid IR entity: ${JSON.stringify(entity)}`);
      }
      if (ids.has(entity.id)) {
        throw new Error(`Duplicate IR entity ID: ${entity.id}`);
      }
      ids.add(entity.id);
    }
  }
}

function extractWithAST(projectDir: string): { ir: ProjectIR; text: string } {
  const parserPath = path.join(process.cwd(), "parsers/php/parser.php").replace(/\\/g, "/");
  try {
    const cmd = `php "${parserPath}" "${projectDir}"`;
    const raw = execSync(cmd, { encoding: "utf-8", stdio: ['pipe', 'pipe', 'pipe'] });
    const ir: ProjectIR = JSON.parse(raw);
    
    validateIR(ir);
    Object.freeze(ir); // Immutability guarantee

    return { 
      ir, 
      text: irToXentariFormat(ir) 
    };
  } catch (e: any) {
    console.error('[DEBUG] AST ERROR:', e.message);
    return { ir: [], text: "Extraction failed or not a PHP project." };
  }
}

export async function runAgent({ input, projectDir, sessionId = "default", onChunk = null, onStatus = null, onContext = null, onMetrics = null, onIntelligence = null, meta = null }: { input: string; projectDir: string; sessionId?: string; onChunk?: ((chunk: string) => void) | null; onStatus?: ((msg: string) => void) | null; onContext?: ((files: unknown[]) => void) | null; onMetrics?: ((m: any) => void) | null; onIntelligence?: ((intel: any) => void) | null; meta?: { command?: string } | null }) {
  const perf: any = { start: 0 }; // Neutralized for zero-entropy
  
  if (!projectDir) {
    throw new Error("projectDir is required");
  }

  const context = buildContext(projectDir);
  perf.scan = 0; // Neutralized

  const intelligence = await detectProject({ files: context.structure, projectDir });
  if (onIntelligence) onIntelligence(intelligence);

  // AST EXTRACTION OVERRIDE (Minimal Deterministic Path)
  const isAnalyzeRequest = input.toLowerCase().includes("analyze") && !input.toLowerCase().includes("modify");
  if (isAnalyzeRequest && (intelligence.primary === 'laravel' || intelligence.primary === 'php')) {
    if (onStatus) onStatus("ast extraction");
    const result = extractWithAST(projectDir);
    return { fullText: result.text, metrics: { latency: 0 }, budget: null };
  }

  // START RUNTIME INITIALIZATION (LLM Path Only)
  const config = loadConfig(projectDir);
  const model = normalizeModel(config.provider, config.model);
  const provider = createProvider(config);
  const history: any[] = [];

  // LLM GUARD FOR PHP/LARAVEL
  if (intelligence.primary === 'laravel' || intelligence.primary === 'php') {
    throw new Error("LLM SHOULD NOT RUN FOR LARAVEL ANALYSIS");
  }

  if (onStatus) onStatus("analyzing context");
  
  const scoredSnippets = (context.snippets ?? [])
    .map(f => {
      const result = scoreFile(f, input, intelligence);
      return { ...f, score: result.score, steps: result.steps };
    });

  const rankedSnippets = optimizeContext(scoredSnippets, input)
    .sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      return a.path.localeCompare(b.path); 
    })
    .slice(0, 15); 

  perf.analysis = 0;

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
- NEVER include headings, summaries, or introductory/concluding text
- ONLY output a flat bullet list of facts

${isCodeMode ? `Code Modification Mode:
- Return JSON object with text and changes.` : `Strict Normalization Mode (IR Extraction):
- Base your answers ONLY on the provided context.
- ALL output MUST be lowercase.
- FORMAT: [file_path] → [symbol] → [action] [normalized-type]`}

---
Project Intelligence:
Primary: ${intelligence.primary}
---
TOP CONTEXT CONTENT:
\${contextText}`;

  const budget = buildPromptWithBudget({
    systemPrompt: systemPrompt,
    userQuery: input,
    files: rankedSnippets,
    history: history,
    maxTokens: 8192,
    reservedForOutput: 1024
  });

  const messages = budget.messages;

  if (onChunk) {
    if (onStatus) onStatus("generating response");
    let fullContent = "";
    const stream = provider.streamChat({ model, messages });
    for await (const data of stream) {
      if (data.type === "chunk") {
        fullContent += data.content;
        onChunk(data.content);
      }
    }

    let sanitizedContent = sanitizeOutput(fullContent);
    return { fullText: sanitizedContent, metrics: { latency: 0 }, budget };
  } else {
    const result = await provider.chat({ model, messages });
    let reply = sanitizeOutput(result.content);
    return {
      message: reply,
      model,
      metrics: { latency: 0 },
      budget
    };
  }
}
