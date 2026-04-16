import { renderHeader } from "../tui/header.js";
import { renderBox } from "./box.js";
import { renderAction } from "./action.js";
import { renderDiff } from "./diff.js";

/**
 * Xentari UI Unified Renderer
 */
export const ui = {
  header: (opts) => renderHeader(opts),
  box: renderBox,
  action: renderAction,
  diff: renderDiff
};

export default ui;
