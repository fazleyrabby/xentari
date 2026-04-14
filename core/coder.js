import { chat } from "./llm.js";
import { getContext } from "./context.js";
import { detectTier, getTierProfile } from "./tier.js";
import { log } from "./logger.js";
import { loadConfig } from "./config.js";
import { enforceConstraints, validateFileOutput } from "./constraints.js";
import { loadIndex } from "./index.ts";
import { loadPattern, validateStructure } from "./patterns.js";
import { selectContext, formatContext } from "./retrieval/contextEngine.ts";
import { getFeedbackForStep, getAdaptiveRules } from "./retrieval/feedbackEngine.ts";

const BASE_SYSTEM = `# 🧠 XENTARI — AGENT PROMPT (E3 — Structure Enforcement READY)

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

function sanitizeImports(code, bundle) {
  const allowed = [
    bundle.targetPath,
    ...(bundle.related || []).map(r => {
      const match = r.match(/=== FILE: (.*?) ===/);
      return match ? match[1] : null;
    }).filter(Boolean)
  ];

  return code.replace(/(?:require\(|from\s+)(['"])(.*?)\1/g, (match, quote, path) => {
    if (path.startsWith('.')) {
      const isAllowed = allowed.some(a => a && a.includes(path.split('/').pop()));
      if (!isAllowed) {
        log.warn(`[SANITIZER] Removing unrequested import: ${path}`);
        return quote + quote;
      }
    }
    return match;
  });
}
function buildPrompt(step, files, feedback, chainContext, { role, pattern, projectDir, systemSnapshot, intent } = {}) {
  const tier = detectTier();
  const index = loadIndex();

  // E5 — Context Engine: Deterministic Context Bundle
  const targetPath = (typeof step === 'string' && step.includes("/")) ? step : (files[0]?.file || "");
  const bundle = selectContext(targetPath, projectDir);

  // E9 — Feedback Engine: Adaptive Context Reduction
  const adaptiveRules = getAdaptiveRules(projectDir, targetPath);
  if (adaptiveRules.smallContext) {
    // Only include target file and closest 1 dependencies
    bundle.files = bundle.files.slice(0, 2);
  }

  const contextBundle = formatContext(bundle);

  let system = `${BASE_SYSTEM}${TIER_RULES[tier]}

==================================================
📦 CONTEXT BUNDLE (E5)
==================================================
${contextBundle}`;

  // E9: Adaptive Constraints (Prompt Level)
  if (adaptiveRules.strictOutput) {
    system += `\n\n==================================================
🔒 STRICT OUTPUT ENFORCEMENT (E9)
==================================================
The system detected previous output issues. 
You MUST be extra careful:
- NO conversational prefix/suffix
- NO markdown fences
- FULL code content for the file
- Balance all braces and parentheses
- DO NOT truncate the implementation.`;
  }

  if (adaptiveRules.strictContracts) {
    system += `\n\n==================================================
🔒 STRICT CONTRACT ENFORCEMENT (E9)
==================================================
Previous contract violations detected. 
Ensure your changes strictly adhere to the system exports and patterns.`;
  }

  // E8 — Intent Engine
  if (intent) {
    system += `\n\n==================================================
📜 INTENT (E8)
==================================================
You MUST align your changes with this intent. Do NOT introduce unrelated logic.

TYPE: ${intent.type}
SCOPE: ${intent.scope}
GOAL: ${intent.description}`;
  }

  // E9 — Feedback Engine (Self-Improvement)
  const historicalFeedback = getFeedbackForStep(projectDir, targetPath);
  if (historicalFeedback) {
    system += historicalFeedback;
  }

  // E7 — Consistency Engine (System Snapshot)
  if (systemSnapshot && systemSnapshot.files) {
    const snapshotStr = Object.entries(systemSnapshot.files)
      .map(([path, info]) => `- ${path}: [${info.exports.join(", ")}]`)
      .join("\n");
    
    system += `\n\n==================================================
📊 SYSTEM SNAPSHOT (E7)
==================================================
This snapshot represents the current state of exports in the system. 
You MUST not break these contracts unless explicitly asked.

FILES:
${snapshotStr}

RELATIONS:
${JSON.stringify(systemSnapshot.relations, null, 2)}`;
  }

  // E3 — Structure Enforcement (ROLE + PATTERN)
  if (role && pattern) {
    const template = await loadPattern(pattern);
    if (template) {
      system += `\n\nROLE: ${role}\nPATTERN: ${pattern}\n\nYou MUST follow this pattern exactly.\n\nYou are ONLY allowed to:\n- fill logic\n- adapt variable names if needed\n\nYou are NOT allowed to:\n- change structure\n- remove functions\n- change exports\n\nTEMPLATE:\n${template}`;
    }
  }

  if (chainContext) {
    system += `\n\nPrevious changes in this session:`;
    if (chainContext.patchSummary) {
      system += `\n${chainContext.patchSummary}`;
    }
  }

  if (feedback) {
    system += `\n\nPrevious attempt had issues:\n${feedback}\nFix these issues and output the corrected file content.`;
  }

  return [
    { role: "system", content: system },
    { role: "user", content: `Instruction: ${step}\n\nOutput the FULL updated content for '${targetPath}'.` },
  ];
}

function extractFileContent(raw, maxFiles = 1) {
  // Integrity Guards (E2): Agent always outputs raw code for a single file.
  // We no longer rely on '=== FILE:' markers.
  const fenced = raw.match(/```(?:[\w-]+)?\s*([\s\S]*?)```/);
  let content = raw.trim();
  if (fenced) {
    content = fenced[1].trim();
  }
  return [{ file: null, content }];
}

export async function generatePatch(step, files, feedback, chainContext, { onToken, metrics, role, pattern, projectDir, systemSnapshot, intent } = {}) {
  const tier = detectTier();
  const profile = getTierProfile();
  const config = loadConfig();
  const maxFiles = tier === "small" ? 1 : profile.maxPatchFiles;

  // Stability (E1): Multi-pass processing for large files
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

  const messages = buildPrompt(step, files, feedback, chainContext, { role, pattern, projectDir, systemSnapshot, intent });
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
  
  // Integrity Guards (E2): Context Import Sanitization
  const targetPath = (typeof step === 'string' && step.includes("/")) ? step : (files[0]?.file || "");
  const bundle = selectContext(targetPath, projectDir);
  const sanitized = sanitizeImports(cleaned, { ...bundle, targetPath });

  const fileUpdates = extractFileContent(sanitized, maxFiles);
  
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

    // E3 — Structure Enforcement (Pattern Enforcement)
    if (role && pattern) {
      try {
        const config = loadConfig();
        const stack = await loadStack(config.stack || "node-basic");
        validateStructure(update.content, role, pattern, stack);
      } catch (e) {
        throw new Error(`Structure violation for ${role}/${pattern}: ${e.message}`);
      }
    }
  }
  
  return fileUpdates;
}

