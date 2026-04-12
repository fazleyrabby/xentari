/**
 * Task 6: RAG Retriever
 * Lightweight retrieval from knowledge index.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config.js";

function scoreFile(file, task) {
  let score = 0;
  const lowerTask = task.toLowerCase();

  // Keyword match (now functions)
  if (file.functions) {
    for (const kw of file.functions) {
      if (lowerTask.includes(kw.toLowerCase())) score += 2;
    }
  }

  // Filename match
  const fileName = file.file.split("/").pop();
  if (lowerTask.includes(fileName.toLowerCase())) {
    score += 10;
  }

  return score;
}

export function retrieveKnowledge(task, projectDir = loadConfig().root) {
  const knowledgePath = join(projectDir, ".xentari", "knowledge.json");
  
  if (!existsSync(knowledgePath)) return [];

  try {
    const db = JSON.parse(readFileSync(knowledgePath, "utf-8"));
    if (!db || !db.files) return [];

    return db.files
      .map(file => ({
        ...file,
        ragScore: scoreFile(file, task)
      }))
      .filter(f => f.ragScore > 0)
      .sort((a, b) => b.ragScore - a.ragScore)
      .slice(0, 3);
  } catch {
    return [];
  }
}
