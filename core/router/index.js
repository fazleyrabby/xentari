import { classifyInput } from "./classifier.js";
import { handleChat } from "./chat.js";
import { executionLoop } from "../execution/engine.js";

export async function route(input, context = {}) {
  const type = classifyInput(input);

  if (type === "CHAT") {
    return await handleChat(input);
  }

  if (type === "EXEC") {
    const result = await executionLoop(input, context);

    return {
      type: "exec",
      result
    };
  }
}
