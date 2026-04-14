import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_FILE = ".xentari/project.json";

// --- Signals ---

function extractSignals(files: string[]) {
  return {
    hasPackageJson: files.includes("package.json"),
    hasComposer: files.includes("composer.json"),
    hasRequirements: files.includes("requirements.txt"),
    hasPyproject: files.includes("pyproject.toml"),
    hasGemfile: files.includes("Gemfile"),
    hasCargo: files.includes("Cargo.toml"),
  };
}

function buildSummary(files: string[], signals: ReturnType<typeof extractSignals>): string {
  const active = Object.entries(signals)
    .filter(([, v]) => v)
    .map(([k]) => k.replace("has", ""));
  return `Files (sample): ${files.slice(0, 20).join(", ")}\nDetected: ${active.join(", ") || "none"}`;
}

function hashFiles(files: string[]): string {
  return crypto.createHash("md5").update(files.slice(0, 50).join("|")).digest("hex");
}

// --- Cache ---

export function getCachedProject(projectDir: string): Record<string, string> | null {
  const p = path.join(projectDir, CACHE_FILE);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export function saveProjectCache(projectDir: string, data: Record<string, string>): void {
  const dir = path.join(projectDir, ".xentari");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, CACHE_FILE), JSON.stringify(data, null, 2));
}

// --- Detect ---

export async function detectProject({
  files,
  provider,
  projectDir,
  model,
}: {
  files: string[];
  provider: { chat: (opts: { model: unknown; messages: unknown[] }) => Promise<{ content: string }> };
  projectDir: string;
  model: unknown;
}): Promise<{ framework: string; type: string; hash: string }> {
  const hash = hashFiles(files);
  const cached = getCachedProject(projectDir);
  if (cached?.hash === hash) return cached as { framework: string; type: string; hash: string };

  const signals = extractSignals(files);
  const summary = buildSummary(files, signals);

  let framework = "unknown";
  let type = "unknown";

  try {
    const res = await provider.chat({
      model,
      messages: [
        {
          role: "user",
          content: `Project structure:\n${summary}\n\nReturn JSON only: { "framework": "", "type": "" }`,
        },
      ],
    });
    const parsed = JSON.parse(res.content.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    framework = parsed.framework || "unknown";
    type = parsed.type || "unknown";
  } catch {
    // LLM fail — keep unknown
  }

  const result = { framework, type, hash };
  saveProjectCache(projectDir, result);
  return result;
}
