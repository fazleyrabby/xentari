import { commands } from "./commands.js";
import { palette } from "./palette.js";
import { loadHistory, addToHistory } from "../session/store.ts";
import { log } from "../logger.js";

export function handleCommand(input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  if (trimmed === "/help" || trimmed === "/palette") {
    log.section("COMMAND PALETTE");
    palette.forEach((cmd, i) => {
      console.log(`  ${(i + 1).toString().padEnd(2)} ${cmd.key.padEnd(10)} → ${cmd.desc}`);
    });
    log.section("CORE COMMANDS");
    Object.entries(commands).forEach(([k, v]) => {
      console.log(`  ${k.padEnd(10)} → ${v}`);
    });
    return true;
  }

  if (trimmed === "/history") {
    const data = loadHistory(process.cwd());
    log.section("SESSION HISTORY");
    if (data.history.length === 0) {
      console.log("  (Empty)");
    } else {
      data.history.forEach((h, i) => {
        console.log(`  ${i + 1}. ${h.task} (${h.files?.length || 0} files)`);
      });
    }
    return true;
  }

  if (trimmed === "/clear") {
    // Implement clear by saving empty history
    const { saveHistory } = await import("../session/store.ts");
    saveHistory(process.cwd(), { history: [] });
    log.ok("Session history cleared");
    return true;
  }

  if (trimmed === "/stats") {
    const data = loadHistory(process.cwd());
    log.section("STATS");
    console.log(`  Tasks in current session: ${data.history.length}`);
    return true;
  }

  if (trimmed === "/exit" || trimmed === "/quit") {
    log.info("Goodbye!");
    process.exit(0);
  }

  // Handle palette shortcuts (e.g. "/1" or "/fix")
  const paletteMatch = palette.find(p => trimmed.startsWith(p.key));
  if (paletteMatch) {
    // Return null so the TUI can treat it as a task but with the desc
    return null; 
  }

  log.error(`Unknown command: ${trimmed}`);
  return true;
}
