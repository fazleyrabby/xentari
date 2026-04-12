import { loadConfig } from "./config.js";

// Model name patterns → tier classification
const SMALL_PATTERNS = [
  /qwen.*[_-]?[0-7]b/i, /llama.*[_-]?[0-8]b/i, /gemma.*[_-]?[0-9]b/i,
  /phi.*[_-]?[0-3]b/i, /mistral.*[_-]?7b/i, /tinyllama/i, /stablelm/i,
  /\b[1-9]b\b/i,
];
const MEDIUM_PATTERNS = [
  /qwen.*[_-]?(1[0-9]|2[0-9]|30)b/i, /llama.*[_-]?(1[0-9]|2[0-9]|30)b/i,
  /mistral.*[_-]?(1[0-9]|2[0-9])b/i, /mixtral/i, /codellama.*[_-]?34b/i,
  /deepseek.*[_-]?(16|20|33)b/i, /\b(1[0-9]|2[0-9]|3[0-3])b\b/i,
];
const LARGE_PATTERNS = [
  /claude/i, /gpt-?4/i, /gpt-?3\.5/i, /o[1-4]/i, /gemini/i,
  /llama.*[_-]?(70|65|405)b/i, /qwen.*[_-]?(70|72|110)b/i,
  /deepseek.*[_-]?(67|236)b/i, /\b([4-9]\d|[1-9]\d{2,})b\b/i,
];

function detectFromName(model) {
  const name = model.toLowerCase();
  for (const re of LARGE_PATTERNS) { if (re.test(name)) return "large"; }
  for (const re of MEDIUM_PATTERNS) { if (re.test(name)) return "medium"; }
  for (const re of SMALL_PATTERNS) { if (re.test(name)) return "small"; }
  // Bare names without size suffix — assume small for local models
  if (/^(qwen|llama|gemma|phi|mistral|codellama)$/i.test(name)) return "small";
  // API model names
  if (/^(claude|gpt|o[1-4]|gemini)/i.test(name)) return "large";
  return "small"; // safe default for local models
}

// Tier-specific limits
const TIER_PROFILES = {
  small: {
    maxFiles: 2,
    maxFileChars: 1000,
    maxTokens: 400,
    maxSteps: 3,
    maxRetries: 2,
    maxPatchFiles: 1,
    maxPatchChars: 12000,
    maxChunks: 2,
  },
  medium: {
    maxFiles: 3,
    maxFileChars: 1500,
    maxTokens: 600,
    maxSteps: 4,
    maxRetries: 3,
    maxPatchFiles: 2,
    maxPatchChars: 20000,
    maxChunks: 3,
  },
  large: {
    maxFiles: 5,
    maxFileChars: 2500,
    maxTokens: 800,
    maxSteps: 5,
    maxRetries: 4,
    maxPatchFiles: 10,
    maxPatchChars: 50000,
    maxChunks: 6,
  },
};

let _tier;
let _profile;

export function detectTier() {
  if (_tier) return _tier;
  const config = loadConfig();
  if (config.modelTier && config.modelTier !== "auto") {
    _tier = config.modelTier;
  } else {
    _tier = detectFromName(config.model);
  }
  return _tier;
}

export function getTierProfile() {
  if (_profile) return _profile;
  _profile = { ...TIER_PROFILES[detectTier()] };
  return _profile;
}

export function getTierLabel() {
  const config = loadConfig();
  return `${config.model} (${detectTier().toUpperCase()})`;
}

// Reset cached tier (for testing or config reload)
export function resetTier() {
  _tier = null;
  _profile = null;
}
