import { loadConfig } from "../config/loadConfig.ts";
import { normalizeModel } from "../providers/normalizeModel.ts";
import { createProvider } from "../providers/index.ts";
import { loadSession, saveSession } from "../session/store.ts";
import { buildContext } from "../context/buildContext.ts";
import { detectProject } from "../context/projectIntelligence.ts";

export async function runAgent({ input, projectDir, sessionId = "default", onChunk = null, onStatus = null, onContext = null }) {
  const config = loadConfig(projectDir);
  const model = normalizeModel(config.provider, config.model);
  const provider = createProvider(config);
  const history = loadSession(projectDir, sessionId);

  if (onStatus) onStatus("scanning project");
  const context = buildContext(projectDir);
  
  if (onContext && context.files) {
    const contextFiles = context.files.map((f, i) => ({
      path: f.path || f, // handle string array fallback
      score: f.score ?? (context.files.length - i) // fallback ranking
    }));
    onContext(contextFiles);
  }
  
  const project = await detectProject({ files: context.structure, provider, projectDir, model });

  if (onStatus) onStatus("analyzing context");

  const systemPrompt = `You are Xentari AI.
Project: ${project.framework} (${project.type}).
You are operating inside a real project directory.
Use the provided project context when answering questions about files or code.

PROJECT CONTEXT:
${JSON.stringify(context, null, 2)}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: input }
  ];

  if (onChunk) {
    if (onStatus) onStatus("generating response");
    let fullContent = "";
    const stream = provider.streamChat({ model, messages });
    for await (const chunk of stream) {
      fullContent += chunk;
      onChunk(chunk);
    }
    
    // Finalize session
    const updated = [
      ...history,
      { role: "user", content: input },
      { role: "assistant", content: fullContent }
    ];
    saveSession(projectDir, sessionId, updated);

    return { fullText: fullContent };
  } else {
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
}
