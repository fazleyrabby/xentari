/**
 * Xentari Test Runner
 * Minimal, zero-dependency runner for deterministic logic.
 */

export async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✔ ${name}`);
  } catch (err) {
    console.error(`✖ ${name} → ${err.message}`);
    process.exitCode = 1;
  }
}
