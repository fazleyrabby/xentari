import crypto from "node:crypto";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

export function getHash(data: string) {
  return crypto.createHash("sha256").update(data || "").digest("hex");
}

export function logObservation(data: {
  jobId: string;
  inputHash: string;
  outputHash: string;
  startTime: number;
  endTime: number;
  durationMs: number;
}) {
  const logEntry = JSON.stringify(data) + "\n";
  
  // Also log to a file for persistence
  try {
    const logDir = join(process.cwd(), "logs");
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, "observations.log");
    appendFileSync(logFile, logEntry);
  } catch (err) {
    // Ignore log file errors to remain non-intrusive
  }
}
