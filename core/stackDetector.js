import fs from "node:fs";
import path from "node:path";

function exists(root, file) {
  return fs.existsSync(path.join(root, file));
}

function readJSON(root, file) {
  try {
    const content = fs.readFileSync(path.join(root, file), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function detectStack(projectPath) {
  const signals = {
    laravel: 0,
    node: 0,
    express: 0,
    nextjs: 0,
    php: 0,
    go: 0,
    rust: 0,
    flutter: 0,
    java: 0,
    unknown: 0
  };

  if (exists(projectPath, "artisan")) signals.laravel += 5;
  if (exists(projectPath, "composer.json")) signals.php += 3;
  if (exists(projectPath, "package.json")) signals.node += 5;
  if (exists(projectPath, "go.mod")) signals.go += 5;
  if (exists(projectPath, "Cargo.toml")) signals.rust += 5;
  if (exists(projectPath, "pubspec.yaml")) signals.flutter += 5;
  if (exists(projectPath, "build.gradle")) signals.java += 5;

  if (exists(projectPath, "routes/web.php")) signals.laravel += 3;
  if (exists(projectPath, "app/Http/Controllers")) signals.laravel += 2;

  if (exists(projectPath, "server.js")) signals.node += 2;
  if (exists(projectPath, "src")) signals.node += 1;

  const pkg = readJSON(projectPath, "package.json");

  if (pkg) {
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies
    };

    if (deps) {
      if (deps["express"]) signals.express += 4;
      if (deps["next"]) signals.nextjs += 5;
      if (deps["nestjs"]) signals.node += 3;
    }
  }

  if (signals.laravel > 0) signals.laravel += 2;
  if (signals.nextjs > 0) signals.nextjs += 2;
  if (signals.express > 0) signals.express += 1;

  const sorted = Object.entries(signals)
    .sort((a, b) => b[1] - a[1]);

  const [stack, score] = sorted[0];

  let confidence = "low";
  if (score >= 8) confidence = "high";
  else if (score >= 4) confidence = "medium";

  return {
    stack: stack === "unknown" || score === 0 ? "node-basic" : stack,
    confidence,
    signals
  };
}
