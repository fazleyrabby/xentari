import { loadConfig } from "../config/loadConfig.ts";
import { normalizeModel } from "../providers/normalizeModel.ts";
import { createProvider } from "../providers/index.ts";
import { loadSession, saveSession } from "../session/store.ts";
import { buildContext } from "../context/buildContext.ts";

export async function runAgent({ input, projectDir, sessionId = "default" }) {
  const config = loadConfig(projectDir);

  const model = normalizeModel(config.provider, config.model);

  const provider = createProvider(config);

  const history = loadSession(projectDir, sessionId);

  const context = buildContext(projectDir);

  const systemPrompt = `You are Xentari AI.
You are operating inside a real project directory.
Use the provided project context when answering questions about files or code.

PROJECT CONTEXT:
${JSON.stringify(context, null, 2)}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: input }
  ];

  const result = await provider.chat({ model, messages });

  const reply = result.content;

  const updated = [
    ...history,
    { role: "user", content: input },
    { role: "assistant", content: reply }
  ];

  saveSession(projectDir, sessionId, updated);

  return {
    message: reply,
    model,
    usage: result.usage
  };
}
