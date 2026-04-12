import { chat } from "./llm.js";
import { getContext } from "./context.js";
import { detectTier, getTierProfile } from "./tier.js";
import { log } from "./logger.js";
import { loadConfig } from "./config.js";
import { enforceConstraints, validateFileOutput } from "./constraints.js";
import { loadIndex } from "./index.ts";

const BASE_SYSTEM = `You are a code editor.

STRICT RULES:
- Output ONLY full file content
- NO markdown fences (unless explicitly asked for a non-code file)
- NO explanations
- NO comments outside code
- Modify ONLY necessary parts
- Start with "=== FILE: <filename> ===" on its own line.

PROJECT STRUCTURE RULES:
- Models go in models/ or src/models/ directory
- Services go in services/ or src/services/ directory  
- Routes go in routes.ts or src/routes.ts
- Controllers go in controllers/ or src/controllers/ directory
- Use .ts extension for TypeScript or .js for JavaScript

IMPORTANT: This is a Node.js project. Use JavaScript/TypeScript only. Do NOT generate Ruby, Python, or other languages.`;

const TIER_RULES = {
  small: `\n\nCRITICAL CONSTRAINTS (small model):
- Modify ONLY ONE file
- Keep changes minimal - fewest lines possible
- Do NOT refactor or restructure existing code
- Do NOT delete existing code unless requested. Ensure the FULL file content is returned.
- Short, simple implementations`,

  medium: `\n\nCONSTRAINTS (medium model):
- Modify at most 2 files
- Keep changes focused and minimal
- Prefer simple, direct implementations`,

  large: `\n\nYou may modify multiple files if needed for a complete implementation.
Ensure all cross-file dependencies (imports, exports) are consistent.`,
};

function detectModule(task) {
  const lower = task.toLowerCase();
  if (lower.includes("auth") || lower.includes("login")) return "authentication";
  if (lower.includes("todo") || lower.includes("task")) return "todos";
  if (lower.includes("user")) return "users";
  if (lower.includes("pay") || lower.includes("billing")) return "payments";
  if (lower.includes("api") || lower.includes("route")) return "api";
  return null;
}

function buildPrompt(step, files, feedback, chainContext) {
  const tier = detectTier();
  const { context } = getContext(step);
  const config = loadConfig();
  const index = loadIndex();
  
  let system = `${context}\n\n${BASE_SYSTEM}${TIER_RULES[tier]}`;

  // Phase 44: Architecture Context Injection
  const targetModule = detectModule(step);
  if (index && targetModule && index.flows && index.flows[targetModule]) {
    const flow = index.flows[targetModule].flow;
    const archHint = `\n[ARCHITECTURE] Module: ${targetModule}\nLogical Flow: ${flow.join(" → ")}`;
    system += archHint;
  }

  if (chainContext) {
    system += `\n\nPrevious changes in this session:`;
    if (chainContext.patchSummary) {
      system += `\n${chainContext.patchSummary}`;
    }
    if (chainContext.modifiedFiles && chainContext.modifiedFiles.length > 0) {
      system += `\nModified files: ${chainContext.modifiedFiles.join(", ")}`;
    }
  }

  if (feedback) {
    system += `\n\nPrevious attempt had issues:\n${feedback}\nFix these issues and output the corrected file content.`;
    if (tier === "small") {
      system += `\nKeep it as simple as possible. One file, minimal changes.`;
    }
  }

  // Phase 37: Multi-File Context injection
  const primaryFiles = files.filter(f => !f.isRelated);
  const relatedFiles = files.filter(f => f.isRelated);

  let fileList = primaryFiles;
  if (config.incrementalContext && primaryFiles.length > 2) {
    fileList = primaryFiles.slice(0, 2);
    log.info(`[CODER] Incremental context active: sending only 2/${primaryFiles.length} files`);
  }

  const fileContext = fileList
    .map((f) => {
      const isPartial = f.content.includes("... [CHUNK BOUNDARY] ...");
      let header = `=== FILE: ${f.file} ===`;
      if (isPartial) {
        header += `\n[NOTE: This is a PARTIAL file. Context may not include full content. Only modify visible parts.]`;
      }
      return `${header}\n${f.content}`;
    })
    .join("\n\n---\n\n");

  const relatedContext = relatedFiles.length > 0
    ? `\n\nRelated files for reference (DO NOT modify these unless requested):\n` + 
      relatedFiles.map(f => `=== RELATED FILE: ${f.file} ===\n${f.content.slice(0, 1000)}`).join("\n\n")
    : "";

  return [
    { role: "system", content: system },
    { role: "user", content: `Task: ${step}\n\nFiles to modify:\n${fileContext}${relatedContext}\n\nOutput the FULL updated content for the primary file(s).` },
  ];
}

function extractFileContent(raw, maxFiles = 1) {
  const lines = raw.split("\n");
  const files = [];
  let currentFile = null;
  let currentContent = [];

  for (const line of lines) {
    const fileMatch = line.match(/^=== FILE:\s*(.+?)\s*===$/);
    if (fileMatch) {
      if (currentFile !== null) {
        files.push({ file: currentFile, content: currentContent.join("\n") });
      }
      if (files.length >= maxFiles) {
        break;
      }
      currentFile = fileMatch[1].trim();
      currentContent = [];
    } else if (currentFile !== null) {
      currentContent.push(line);
    }
  }

  if (currentFile !== null && files.length < maxFiles) {
    files.push({ file: currentFile, content: currentContent.join("\n") });
  }

  // Fallback for models that don't use the marker properly
  if (files.length === 0) {
    const fenced = raw.match(/```(?:js|javascript|ts|typescript)?\s*([\s\S]*?)```/);
    if (fenced) {
      return [{ file: null, content: fenced[1].trim() }];
    }
    return [{ file: null, content: raw.trim() }];
  }

  return files.slice(0, maxFiles);
}

export async function generatePatch(step, files, feedback, chainContext, { onToken, metrics } = {}) {
  const tier = detectTier();
  const profile = getTierProfile();
  const config = loadConfig();
  const maxFiles = tier === "small" ? 1 : profile.maxPatchFiles;

  // Task 6: Multi-pass processing for large files
  const largeFiles = files.filter(f => f.content.includes("... [CHUNK BOUNDARY] ..."));
  let analysis = "";

  if (largeFiles.length > 0 && tier !== "small") {
    log.info(`[CODER] Analyzing ${largeFiles.length} large file(s)...`);
    const analysisPrompt = [
      { role: "system", content: "You are a code analyst. Analyze the following partial file chunks and summarize how they relate to the task." },
      { role: "user", content: `Task: ${step}\n\nChunks:\n${largeFiles.map(f => f.content).join("\n\n---\n\n")}` }
    ];
    analysis = await chat(analysisPrompt, { maxTokens: 300, metrics });
    log.info(`[CODER] Analysis complete.`);
  }

  const messages = buildPrompt(step, files, feedback, chainContext);
  if (analysis) {
    messages[messages.length - 1].content += `\n\nFile Analysis:\n${analysis}`;
  }

  const raw = await chat(messages, { 
    maxTokens: profile.maxTokens,
    stream: !!onToken,
    onToken,
    metrics
  });

  if (onToken) process.stdout.write("\n");

  // Apply Constraint Engine
  const constraintRules = [
    { type: "no_markdown" },
    { type: "no_explanations" },
    { type: "trim" }
  ];
  const cleaned = enforceConstraints(raw, constraintRules, metrics);
  
  const fileUpdates = extractFileContent(cleaned, maxFiles);
  
  if (fileUpdates.length === 0) {
    throw new Error("No valid file content extracted from LLM response");
  }

  if (tier === "small" && fileUpdates.length > 1) {
    fileUpdates.length = 1;
  }

  for (const update of fileUpdates) {
    // Basic validation
    const validation = validateFileOutput(update.content);
    if (!validation.valid) {
      throw new Error(`Output validation failed: ${validation.reason}`);
    }

    // Size guard
    if (update.content.length > config.maxPatchChars * 2) { // Allow some headroom for full file
      throw new Error("Generated content too large");
    }

    if (!update.file && files.length > 0) {
      update.file = files[0].file; // Use first file if marker missing but we have context
    }
    
    if (!update.file) {
      throw new Error("Missing file path in generated content");
    }
  }
  
  return fileUpdates;
}
