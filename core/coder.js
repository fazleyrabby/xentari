import { chat } from "./llm.js";
import { getContext } from "./context.js";
import { detectTier, getTierProfile } from "./tier.js";
import { log } from "./logger.js";
import { loadConfig } from "./config.js";
import { enforceConstraints, validateFileOutput } from "./constraints.js";
import { loadIndex } from "./index.ts";

const BASE_SYSTEM = `# 🧠 XENTARI — AGENT PROMPT (PHASE 3 READY)

You are a deterministic code generator inside Xentari operating on a structured project.

Your job is to:
→ execute ONE task at a time
→ generate a COMPLETE file for the given targetPath
→ strictly follow project structure, rules, and constraints

You are NOT an assistant.
You do NOT explain.
You ONLY output raw code.

--------------------------------------------------
🎯 EXECUTION MODEL
--------------------------------------------------

The system operates as a linear state machine:

plan.json → state.json → task → code → validate → patch → next task

You MUST respect this flow.

--------------------------------------------------
🔒 HARD RULES (NON-NEGOTIABLE)
--------------------------------------------------

1. OUTPUT FORMAT
- raw code only
- NO markdown (NO \`\`\` fences)
- NO explanations
- NO comments describing changes
- MUST be complete file

2. FILE TARGETING
- ONLY modify targetPath
- NEVER create or reference other files
- NEVER split output

3. COMPLETENESS
- no TODO
- no stub
- must be runnable and coherent

4. CONSISTENCY
If existingContent exists:
- preserve logic
- extend safely
- DO NOT remove unrelated code

5. NO DESTRUCTIVE CHANGES
- no shrinking file drastically
- no deleting functions/classes unless required

6. DEPENDENCIES
- ONLY use allowed dependencies from dependencies.json
- NEVER introduce new libraries

7. STYLE
- follow conventions strictly
- match existing patterns

--------------------------------------------------
🚫 FORBIDDEN
--------------------------------------------------

- markdown fences (\`\`\`)
- diff output
- explanations
- multiple files
- ignoring existingContent
- hallucinated imports

--------------------------------------------------
📤 OUTPUT CONTRACT
--------------------------------------------------

Return ONLY the final file content.

Nothing else.`;




const TIER_RULES = {
  small: `\n\nCRITICAL CONSTRAINTS (small model):
- Modify ONLY ONE file
- Keep changes minimal - fewest lines possible
- Do NOT refactor or restructure existing code
- Do NOT delete existing code unless requested. Ensure the FULL file content is returned.
- Short, simple implementations`,

  medium: `\n\nCONSTRAINTS (medium model):
- Modify ONLY ONE file
- Keep changes focused and minimal
- Prefer simple, direct implementations`,

  large: `\n\nCONSTRAINTS (large model):
- Modify ONLY ONE file per step
- Ensure all imports and exports for this specific file are consistent.`,
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
  // Phase 3 Integrity: Agent always outputs raw code for a single file.
  // We no longer rely on '=== FILE:' markers.
  const fenced = raw.match(/```(?:[\w-]+)?\s*([\s\S]*?)```/);
  let content = raw.trim();
  if (fenced) {
    content = fenced[1].trim();
  }
  return [{ file: null, content }];
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


  }
  
  return fileUpdates;
}
