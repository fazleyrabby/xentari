import { pythonProfile } from "./python.js";
import { javaProfile } from "./java.js";
import { goProfile } from "./go.js";
import { rubyProfile } from "./ruby.js";

export function getStackProfile(stack) {
  switch (stack) {
    case "python": return pythonProfile;
    case "java": return javaProfile;
    case "go": return goProfile;
    case "ruby": return rubyProfile;
    default: return null;
  }
}
