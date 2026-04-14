import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadIndex } from "../index.ts";
import { loadPattern } from "../patterns.js";

/**
 * 🧠 XENTARI — E5 — Context Engine
 */

export type ContextBundle = {
  target: string;
  related: string[];
  pattern: string;
  rules: string;
};

const RELATION_MAP: Record<string, string[]> = {
  "user.controller.js": ["user.service.js"],
  "user.service.js": ["user.model.js"],
  "todo.controller.js": ["todo.service.js"]
};

/**
 * 1. CONTEXT SELECTOR
 */
export function selectContext(targetPath: string, projectDir: string = process.cwd()): ContextBundle {
  return {
    target: getTargetFile(targetPath, projectDir),
    related: getRelatedFiles(targetPath, projectDir),
    pattern: getPattern(targetPath),
    rules: getRules(projectDir)
  };
}

/**
 * Helper to read target file
 */
function getTargetFile(targetPath: string, projectDir: string): string {
  const fullPath = join(projectDir, targetPath);
  if (!existsSync(fullPath)) return "";
  return readFileSync(fullPath, "utf-8");
}

/**
 * 2. RELATION MAP & 3. IMPORT PARSER (AUTO CONTEXT)
 */
function getRelatedFiles(targetPath: string, projectDir: string): string[] {
  const index = loadIndex(projectDir);
  const relatedFiles: string[] = [];
  
  // Static Relation Map Fallback
  const staticRelated = RELATION_MAP[targetPath] || [];
  for (const rel of staticRelated) {
    relatedFiles.push(rel);
  }

  // Auto Context via Index (Phase 33-35)
  if (index) {
    const deps = index.dependencies?.[targetPath] || [];
    const reverse = index.reverseDependencies?.[targetPath] || [];
    [...deps, ...reverse].forEach(d => {
      if (!relatedFiles.includes(d) && d !== targetPath) {
        relatedFiles.push(d);
      }
    });
  }

  // 4. CONTEXT LIMITER
  const MAX_FILES = 3;
  const limited = relatedFiles.slice(0, MAX_FILES);

  return limited.map(file => {
    const fullPath = join(projectDir, file);
    if (!existsSync(fullPath)) return `=== FILE: ${file} ===\n(Missing)`;
    const content = readFileSync(fullPath, "utf-8");
    return `=== FILE: ${file} ===\n${content}`;
  });
}

/**
 * Get Pattern Template
 */
function getPattern(targetPath: string): string {
  // Infer pattern from targetPath
  if (targetPath.includes("controller")) return loadPattern("controller") || "";
  if (targetPath.includes("service")) return loadPattern("service") || "";
  if (targetPath.includes("route")) return loadPattern("routes") || "";
  if (targetPath.includes("model")) return loadPattern("model") || "";
  return "";
}

/**
 * Get Rules
 */
function getRules(projectDir: string): string {
  const rulesPath = join(projectDir, "context/rules.md");
  if (!existsSync(rulesPath)) return "";
  return readFileSync(rulesPath, "utf-8");
}

/**
 * 5. CONTEXT FORMATTER
 */
export function formatContext(bundle: ContextBundle): string {
  return `
TARGET FILE:
${bundle.target || "(Empty or New File)"}

RELATED FILES:
${bundle.related.length > 0 ? bundle.related.join('\n\n') : "(None)"}

PATTERN:
${bundle.pattern || "(No pattern assigned)"}

RULES:
${bundle.rules || "(No global rules)"}
`;
}
