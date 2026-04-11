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

  // Keyword match
  if (file.keywords) {
    for (const kw of file.keywords) {
      if (lowerTask.includes(kw)) score += 2;
    }
  }

  // Export match
  if (file.exports) {
    for (const exp of file.exports) {
      if (lowerTask.includes(exp.toLowerCase())) score += 3;
    }
  }

  // Filename match
  const fileName = file.path.split("/").pop();
  if (lowerTask.includes(fileName.toLowerCase())) {
    score += 10;
  }

  return score;
}

export function retrieveKnowledge(task) {
  const config = loadConfig();
  const knowledgePath = join(config.logsDir, "knowledge.json");
  const indexPath = join(config.logsDir, "index.json");
  
  const path = existsSync(knowledgePath) ? knowledgePath : indexPath;
  if (!existsSync(path)) return [];

  try {
    const db = JSON.parse(readFileSync(path, "utf-8"));
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
