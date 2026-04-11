import { chat } from "./llm.js";
import { getSummary } from "./context.js";
import { detectTier, getTierProfile } from "./tier.js";

const BASE_SYSTEM = `You are a code editor. You output the FULL UPDATED FILE content only.

IMPORTANT (STRICT):
- Modify ONLY ONE file
- Return ONLY ONE file
- Do NOT include multiple files
- Do NOT include explanations
- Output ONLY the complete file content
- Include ALL existing code - do not remove unless explicitly requested
- If adding new code, integrate it properly with existing code
- If creating a new file, output the full file content
- Use correct file paths relative to project root
- Every function and import MUST be complete
- NO prose, NO markdown fences, NO comments outside the code

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
- Short, simple implementations`,

  medium: `\n\nCONSTRAINTS (medium model):
- Modify at most 2 files
- Keep changes focused and minimal
- Prefer simple, direct implementations`,

  large: `\n\nYou may modify multiple files if needed for a complete implementation.
Ensure all cross-file dependencies (imports, exports) are consistent.`,
};

function buildPrompt(step, files, feedback, chainContext) {
  const tier = detectTier();
  let system = `${getSummary()}\n\n${BASE_SYSTEM}${TIER_RULES[tier]}`;

  if (chainContext) {
    system += `\n\nPrevious changes in this session:`;
    if (chainContext.patchSummary) {
      system += `\n${chainContext.patchSummary}`;
    }
    if (chainContext.modifiedFiles.length > 0) {
      system += `\nModified files: ${chainContext.modifiedFiles.join(", ")}`;
    }
  }

  if (feedback) {
    system += `\n\nPrevious attempt had issues:\n${feedback}\nFix these issues and output the corrected file content.`;
    if (tier === "small") {
      system += `\nKeep it as simple as possible. One file, minimal changes.`;
    }
  }

  const fileContext = files
    .map((f) => `=== FILE: ${f.file} ===\n${f.content}`)
    .join("\n\n---\n\n");

  return [
    { role: "system", content: system },
    { role: "user", content: `Task: ${step}\n\nFiles to modify:\n${fileContext}\n\nOutput the FULL updated content for the file. Start with "=== FILE: <filename> ===" on its own line.` },
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

  if (files.length === 0) {
    const fenced = raw.match(/```(?:js|javascript|ts|typescript)?\s*([\s\S]*?)```/);
    if (fenced) {
      const content = fenced[1].trim();
      const firstFile = files.length > 0 ? files[0].file : null;
      return [{ file: firstFile, content }];
    }
    return [{ file: null, content: raw.trim() }];
  }

  return files.slice(0, maxFiles);
}

function cleanOutput(content) {
  if (!content) return "";

  content = content.replace(/```[\w]*\n([\s\S]*?)```/g, "$1");
  content = content.replace(/```/g, "");

  return content.trim();
}

function validateGeneratedContent(content) {
  if (!content || content.length < 10) {
    throw new Error("Generated content is empty or too small");
  }

  if (
    content.includes("Here is") ||
    content.includes("Explanation") ||
    content.includes("This code")
  ) {
    throw new Error("LLM returned explanation instead of raw code");
  }

  return true;
}

function validateContent(content) {
  if (!content || content.length === 0) {
    throw new Error("Invalid content: empty response from LLM");
  }
  if (content.includes("```")) {
    throw new Error("Invalid content: LLM returned markdown fences. Output raw code only.");
  }
  const lower = content.toLowerCase();
  if (lower.includes("here is the") || lower.includes("here's the") || lower.startsWith("based on")) {
    throw new Error("Invalid content: LLM included prose explanation. Output only code.");
  }
}

export async function generatePatch(step, files, feedback, chainContext) {
  const tier = detectTier();
  const profile = getTierProfile();
  const maxFiles = tier === "small" ? 1 : profile.maxPatchFiles;
  
  const messages = buildPrompt(step, files, feedback, chainContext);
  const raw = await chat(messages, { maxTokens: profile.maxTokens });
  
  const fileUpdates = extractFileContent(raw, maxFiles);
  
  log.info("[CODER] Cleaned markdown artifacts");
  
  if (fileUpdates.length === 0) {
    throw new Error("No valid file content extracted from LLM response");
  }

  if (tier === "small" && fileUpdates.length > 1) {
    fileUpdates.length = 1;
  }

  for (const { file, content } of fileUpdates) {
    file.content = cleanOutput(content);
    validateGeneratedContent(file.content);
    if (!file) {
      throw new Error("Missing file path in generated content");
    }
  }
  
  return fileUpdates;
}