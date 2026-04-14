import { getContext } from "../context/contextEngine.js";
import { getRuntime } from "../runtime/context.js";
import { getProvider } from "../providers/registry.js";

/**
 * Xentari Agent Execution Loop
 * THOUGHT → PLAN → ACT → OBSERVE → RESPOND
 */
export async function runAgentLoop(input, history = [], onProgress) {
  const context = getContext();
  const { model } = getRuntime();
  const providerKey = model?.split(":")[0] || "ollama";
  const provider = getProvider(providerKey);

  if (!provider) throw new Error(`Provider ${providerKey} not found`);

  // 1. THINKING Phase
  onProgress({ phase: "thinking" });
  
  // (In a real implementation, we would call the model here to generate a plan)
  // For now, we simulate the transition to planning
  await new Promise(r => setTimeout(r, 600));

  // 2. PLANNING Phase
  onProgress({ phase: "planning" });
  
  // Here we would extract tools from the model thought
  // For v2, we focus on the streaming conversation flow first
  await new Promise(r => setTimeout(r, 800));

  // 3. EXECUTING Phase (Reserved for tool calls)
  // onProgress({ phase: "executing" });

  // 4. RESPONDING Phase (Real Streaming)
  onProgress({ phase: "responding" });

  const historyMessages = (history || []).map(m => ({
    role: m.role || "user",
    content: m.content
  }));

  const systemPrompt = `You are Xentari, a deterministic AI coding agent.
CONTEXT:
${JSON.stringify(context, null, 2)}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...historyMessages
  ];

  const fullText = await provider.streamChat({
    model,
    messages,
    onToken: (data) => {
      onProgress({ 
        phase: "responding", 
        token: data.token, 
        fullText: data.fullText,
        metrics: {
          latency: data.latency,
          tps: data.tps,
          tokens: data.tokens
        }
      });
    }
  });

  return fullText;
}
