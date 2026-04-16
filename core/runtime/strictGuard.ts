type ContextFile = {
  path: string;
  content?: string;
};

type GuardResult = {
  valid: boolean;
  violations: string[];
  sanitized?: string;
};

/**
 * 🧠 XENTARI — Deterministic Strict Mode Guard
 * Ensures responses are grounded strictly in the provided context.
 */
export function strictModeGuard(
  response: string,
  contextFiles: ContextFile[]
): GuardResult {
  const violations: string[] = [];

  // 1. DETERMINISTIC VOCABULARY GUARD
  const allowedVocabulary = new Set([
    "class", "method", "defines", "returns", "string", "number", "boolean", "void", "relation", "mixed",
    "has-many", "has-one", "belongs-to", "belongs-to-many"
  ]);

  if (/[A-Z]/.test(response) && !response.includes("not present")) {
    violations.push("Uppercase letters detected. All IR output MUST be lowercase.");
  }

  // 2. FORMAT GUARD (Extraction Contract)
  const lines = response.split('\n').filter(l => l.trim().length > 0);
  // Pattern: [path] → [symbol] → [action] [normalized-type]
  const formatPattern = /^.+? \u2192 .+? \u2192 (defines|returns) ([a-z\-]+)$/;
  
  const fileSummaryMap: Record<string, { hasClass: boolean; methods: number; lines: string[] }> = {};

  for (const line of lines) {
    if (line.includes("not present")) continue;

    const match = line.match(formatPattern);
    if (!match) {
      violations.push(`Invalid IR format or verb on line: "${line.slice(0, 50)}..."`);
    } else {
      const type = match[2];
      if (!allowedVocabulary.has(type) && type !== "class") {
        violations.push(`Forbidden token/type detected: "${type}"`);
      }
    }

    if (line.includes('#') || line.startsWith('**')) {
      violations.push("Headings or bold sections are forbidden");
    }

    if (!line.includes(' \u2192 ')) {
      violations.push(`Line missing " \u2192 " separator: "${line}"`);
    }

    const parts = line.split(' \u2192 ');
    if (parts.length >= 2) {
      const filePath = parts[0].trim();
      const symbol = parts[1].trim();
      
      // Every line MUST have a file path at the start
      if (!filePath.includes('.') && !filePath.includes('/')) {
        violations.push(`Line missing file path: "${line}"`);
      }

      if (!fileSummaryMap[filePath]) {
        fileSummaryMap[filePath] = { hasClass: false, methods: 0, lines: [] };
      }

      fileSummaryMap[filePath].lines.push(line);

      if (symbol.toLowerCase().startsWith('class ')) {
        if (fileSummaryMap[filePath].hasClass) {
          violations.push(`Duplicate class definition for ${filePath}`);
        }
        fileSummaryMap[filePath].hasClass = true;
        // CLASS FIRST check
        if (fileSummaryMap[filePath].lines.length > 1) {
          violations.push(`Class definition MUST be the first line for ${filePath}`);
        }
      } else if (symbol.includes('(')) {
        fileSummaryMap[filePath].methods++;
      }
    }
  }

  // Enforcement: Every file mentioned MUST have EXACTLY one class definition and ALL methods
  Object.entries(fileSummaryMap).sort((a, b) => a[0].localeCompare(b[0])).forEach(([file, info]) => {
    if (file.includes("not present")) return;
    if (!info.hasClass && !file.endsWith('.json') && !file.endsWith('.yaml') && !file.endsWith('.config.js')) {
      violations.push(`File-bound extraction failed: Missing class definition for ${file}`);
    }
    if (info.methods === 0 && !file.endsWith('.json') && !file.endsWith('.yaml') && !file.endsWith('.config.js')) {
      violations.push(`No methods extracted for ${file}. Contract requires full method list per file.`);
    }
  });

  // Duplicate Check
  const uniqueLines = new Set(lines);
  if (uniqueLines.size !== lines.length) {
    violations.push("Duplicate lines detected in output");
  }

  // 3. TOKEN GROUNDING (Single-pass context index)
  const knownTokens = buildContextTokenSet(contextFiles);
  const entities = extractEntities(response);

  const unknownEntities = entities.filter(e => !knownTokens.has(e.toLowerCase()));

  if (unknownEntities.length > 0) {
    violations.push(`Out-of-context identifiers: ${unknownEntities.slice(0, 5).join(", ")}`);
  }

  // 3. STRUCTURAL ASSUMPTION GUARD
  const structuralClaims = [
    /\bproject (uses|follows|implements)\b/i,
    /\bapplication architecture\b/i,
    /\bstructure includes\b/i
  ];

  if (unknownEntities.length > 0) {
    for (const claim of structuralClaims) {
      if (claim.test(response)) {
        violations.push("Unverified structural claim containing unknown entities");
        break;
      }
    }
  }

  if (violations.length === 0) {
    return { valid: true, violations: [] };
  }

  return {
    valid: false,
    violations,
    sanitized: sanitizeResponse(response, knownTokens)
  };
}

/**
 * Extracts high-signal identifiers (Classes, Files, Variables, snake_case).
 * Ignores common lowercase English words to reduce noise.
 */
function extractEntities(text: string): string[] {
  const entityPatterns = [
    /\b[A-Z][a-zA-Z0-9]{3,}\b/g,           // PascalCase (Services, Controllers)
    /\b[a-z]+[A-Z][a-zA-Z0-9]+\b/g,        // camelCase (variables, functions)
    /\b[a-zA-Z0-9_\-]+\.[a-z]{2,4}\b/g,    // file.ext (Files)
    /\b[a-zA-Z]+_[a-zA-Z0-9_]+\b/g         // snake_case (DB columns, config keys)
  ];

  const genericExclusions = new Set(["project", "system", "code", "file", "folder", "directory", "logic", "context"]);
  const results = new Set<string>();

  for (const pattern of entityPatterns) {
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      if (!genericExclusions.has(match.toLowerCase())) {
        results.add(match);
      }
    }
  }

  return Array.from(results);
}

/**
 * Builds a fast lookup set of all valid tokens in the project context.
 */
function buildContextTokenSet(files: ContextFile[]): Set<string> {
  const tokens = new Set<string>();

  // Technical "safe" tokens that are always grounded in system behavior
  ["controller", "service", "model", "route", "api", "config", "app", "src"].forEach(t => tokens.add(t));

  for (const file of files) {
    // Index file path components
    file.path.split(/[\/\.\-_]/).forEach(part => {
      if (part.length > 2) tokens.add(part.toLowerCase());
    });

    // Index meaningful content tokens
    if (file.content) {
      // Single pass regex for all identifier-like strings in content
      const contentTokens = file.content.match(/[a-zA-Z0-9_]{3,}/g) || [];
      for (const token of contentTokens) {
        tokens.add(token.toLowerCase());
      }
    }
  }

  return tokens;
}

/**
 * Safely filters the response to only grounded statements.
 */
function sanitizeResponse(response: string, knownTokens: Set<string>): string {
  const lines = response.split("\n");
  const validLines = lines.filter(line => {
    const lineEntities = extractEntities(line);
    // A line is valid if every meaningful entity it mentions exists in context
    return lineEntities.every(e => knownTokens.has(e.toLowerCase()));
  });

  if (validLines.length === 0) {
    return "Refusal: I cannot verify these details in the current project context.";
  }

  return validLines.join("\n").trim();
}
