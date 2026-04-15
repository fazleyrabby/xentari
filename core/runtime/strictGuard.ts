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

  // 1. SPECULATIVE PATTERN CHECK (Deterministic Refusal)
  const speculativePatterns = [
    /\blikely\b/i,
    /\bprobably\b/i,
    /\btypically\b/i,
    /\busually\b/i,
    /\bcommon(ly)?\b/i,
    /\b(standard|typical|expected) .*(structure|pattern|setup)\b/i,
    /\b(assum|presum|suppos)(ing|e|ed)\b/i,
    /\b(might|may|could) be\b/i
  ];

  for (const pattern of speculativePatterns) {
    if (pattern.test(response)) {
      violations.push(`Speculative claim detected: "${response.match(pattern)?.[0]}"`);
    }
  }

  // 2. TOKEN GROUNDING (Single-pass context index)
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
