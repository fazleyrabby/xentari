export function showStage(name) {
  console.log(`\n⚙️  [${name}]`);
}

export function success(msg) {
  console.log(`\n✔ ${msg}`);
}

export function warn(msg) {
  console.log(`\n⚠ ${msg}`);
}

export function error(msg) {
  console.log(`\n✖ ${msg}`);
}

export function showContext(state) {
  console.log("\n📌 Context:");
  console.log(`  Stack:     ${state.stack || "-"}`);
  console.log(`  Framework: ${state.framework || "-"}`);
  console.log(`  Project:   ${state.projectRoot || "-"}`);
}
