import fs from "node:fs";
import path from "node:path";

function exists(root, file) {
  return fs.existsSync(path.join(root, file));
}

export function detectStack(root) {
  let stack = "unknown";
  let framework = "";

  if (exists(root, "package.json")) stack = "node";
  else if (exists(root, "composer.json")) stack = "php";
  else if (exists(root, "requirements.txt") || exists(root, "pyproject.toml")) stack = "python";
  else if (fs.readdirSync(root).some(f => f.endsWith(".csproj"))) stack = "dotnet";
  else if (exists(root, "pom.xml") || exists(root, "build.gradle")) stack = "java";
  else if (exists(root, "go.mod")) stack = "go";
  else if (exists(root, "Gemfile")) stack = "ruby";
  else if (exists(root, "pubspec.yaml")) stack = "flutter";

  // Framework detection (Task 5)
  if (exists(root, "artisan")) framework = "laravel";
  if (exists(root, "manage.py")) framework = "django";
  if (exists(root, "next.config.js") || exists(root, "next.config.mjs")) framework = "nextjs";

  return { stack, framework };
}
