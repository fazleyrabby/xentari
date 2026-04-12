import { theme } from "./colors.js";
export function showStage(name) {
    console.log(theme.primary(`\n⚙️  [${name}]`));
}
export function success(msg) {
    console.log(theme.success(`\n✔ ${msg}`));
}
export function warn(msg) {
    console.log(theme.warn(`\n⚠ ${msg}`));
}
export function error(msg) {
    console.log(theme.error(`\n✖ ${msg}`));
}
export function showContext(state) {
    console.log(theme.info("\n📌 Context:"));
    console.log(`  Stack:     ${state.stack || "-"}`);
    console.log(`  Framework: ${state.framework || "-"}`);
    console.log(`  Project:   ${state.projectRoot || "-"}`);
}
