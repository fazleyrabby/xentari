const RESET = "\x1b[0m";

export const colors = {
  primary: (t) => `\x1b[36m${t}${RESET}`, // cyan
  success: (t) => `\x1b[32m${t}${RESET}`, // green
  warn: (t) => `\x1b[33m${t}${RESET}`, // yellow
  error: (t) => `\x1b[31m${t}${RESET}`, // red
  info: (t) => `\x1b[34m${t}${RESET}`, // blue
  muted: (t) => `\x1b[90m${t}${RESET}`, // gray
  highlight: (t) => `\x1b[35m${t}${RESET}`, // magenta
};

let ENABLE_COLORS = true;

export function setColorMode(enabled) {
  ENABLE_COLORS = enabled;
}

const wrap = (colorFn) => (text) =>
  ENABLE_COLORS ? colorFn(text) : text;

export const theme = {
  primary: wrap(colors.primary),
  success: wrap(colors.success),
  warn: wrap(colors.warn),
  error: wrap(colors.error),
  info: wrap(colors.info),
  muted: wrap(colors.muted),
  highlight: wrap(colors.highlight),
};
