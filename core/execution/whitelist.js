const allowedCommands = [
  "npm install",
  "npm run dev",
  "node index.js",
  "php artisan serve",
  "go run",
  "cargo run",
];

export function isWhitelisted(command) {
  return allowedCommands.some((cmd) => command.startsWith(cmd));
}
