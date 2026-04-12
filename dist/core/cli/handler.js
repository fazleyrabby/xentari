import { commands } from "./commands.js";
import { palette } from "./palette.js";
import { loadSession, clearSession } from "../memory/session.js";
import { log } from "../logger.js";
export function handleCommand(input) {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/"))
        return null;
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
        const session = loadSession();
        log.section("SESSION HISTORY");
        if (session.history.length === 0) {
            console.log("  (Empty)");
        }
        else {
            session.history.forEach((h, i) => {
                console.log(`  ${i + 1}. ${h.task} (${h.files.length} files)`);
            });
        }
        return true;
    }
    if (trimmed === "/clear") {
        clearSession();
        log.ok("Session history cleared");
        return true;
    }
    if (trimmed === "/stats") {
        // Basic stats for now, can be expanded
        const session = loadSession();
        log.section("STATS");
        console.log(`  Tasks in current session: ${session.history.length}`);
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
