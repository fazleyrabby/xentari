/**
 * E11 — Structured Command Whitelist
 * Defines specific allowed commands and their argument patterns.
 */
const whitelist = {
  npm: ["install", "run", "test"],
  node: ["index.js", "server.js", "app.js"],
  php: ["artisan"],
  go: ["run", "test", "build"],
  cargo: ["run", "test", "build"],
  git: ["status", "diff", "add", "commit", "log"]
};

export function isWhitelisted(parsed) {
  const { command, args } = parsed;

  if (!whitelist[command]) return false;

  // If no arguments, we trust the base command if it's in the whitelist keys
  if (args.length === 0) return true;

  // Check if the first argument (or the start of the args string) is whitelisted for this command
  return whitelist[command].some((allowed) =>
    args.join(" ").startsWith(allowed)
  );
}
