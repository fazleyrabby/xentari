/**
 * 🧠 XENTARI — Context Budget Engine
 * Deterministic token estimation and budget-aware prompt construction.
 */

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface FileSnippet {
  path: string;
  content: string;
  score?: number;
}

export interface BudgetResult {
  messages: Message[];
  tokens: {
    total: number;
    system: number;
    user: number;
    files: number;
    history: number;
    reserved: number;
  };
  limit: number;
  trimmed: boolean;
}

/**
 * Deterministic token estimation (heuristic: 1 token ≈ 4 characters).
 * O(n) complexity.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Builds a prompt strictly within the token budget.
 * Priority: system > user > files > history.
 */
export function buildPromptWithBudget({
  systemPrompt,
  userQuery,
  files,
  history,
  maxTokens = 8192,
  reservedForOutput = 1024
}: {
  systemPrompt: string;
  userQuery: string;
  files: FileSnippet[];
  history: Message[];
  maxTokens?: number;
  reservedForOutput?: number;
}): BudgetResult {
  const budget = maxTokens - reservedForOutput;
  let currentTokens = 0;
  let trimmed = false;

  // 1. System Prompt (Highest Priority)
  const systemTokens = estimateTokens(systemPrompt);
  currentTokens += systemTokens;

  // 2. User Query (Highest Priority)
  const userTokens = estimateTokens(userQuery);
  currentTokens += userTokens;

  if (currentTokens > budget) {
    // Critical overflow: even system + user is too large
    // In this case, we have to truncate the system prompt or user query, 
    // but we'll flag it as trimmed.
    trimmed = true;
    // We don't truncate system/user here to keep it simple, but we'll return the overage.
  }

  // 3. Files (Higher Priority than History)
  const sortedFiles = [...files].sort((a, b) => (b.score || 0) - (a.score || 0));
  const includedFiles: FileSnippet[] = [];
  let filesTokens = 0;

  for (const file of sortedFiles) {
    const fileText = `FILE: ${file.path}\nCONTENT:\n${file.content}\n---\n`;
    const fTokens = estimateTokens(fileText);
    
    if (currentTokens + fTokens <= budget) {
      currentTokens += fTokens;
      filesTokens += fTokens;
      includedFiles.push(file);
    } else {
      trimmed = true;
      // Skip file if it doesn't fit
    }
  }

  // Build the combined context text
  const contextText = includedFiles
    .map(f => `FILE: ${f.path}\nCONTENT:\n${f.content}\n---`)
    .join('\n\n');

  // Re-build system prompt with files embedded if needed, or just keep them separate
  // The system prompt in runAgent.ts already includes the contextText placeholder.
  // We'll return the final messages array.
  
  const finalSystemPrompt = systemPrompt.replace("${contextText}", contextText);
  // Re-estimate system tokens because we injected the files
  const finalSystemTokens = estimateTokens(finalSystemPrompt);

  // 4. History (Lowest Priority)
  const includedHistory: Message[] = [];
  let historyTokens = 0;
  
  // Start from most recent history
  const reversedHistory = [...history].reverse();
  for (const msg of reversedHistory) {
    const mTokens = estimateTokens(msg.content) + 4; // Add small overhead for role/metadata
    if (currentTokens + mTokens <= budget) {
      currentTokens += mTokens;
      historyTokens += mTokens;
      includedHistory.unshift(msg); // Put back in original order
    } else {
      trimmed = true;
      // History is full
      break;
    }
  }

  const finalMessages: Message[] = [
    { role: "system", content: finalSystemPrompt },
    ...includedHistory,
    { role: "user", content: userQuery }
  ];

  return {
    messages: finalMessages,
    tokens: {
      total: currentTokens,
      system: finalSystemTokens,
      user: userTokens,
      files: filesTokens,
      history: historyTokens,
      reserved: reservedForOutput
    },
    limit: maxTokens,
    trimmed
  };
}
