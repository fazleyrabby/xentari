import { useEffect, useState } from "react";

export default function App() {
  const [state, setState] = useState({});
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000");

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "STATE_UPDATE") {
        setState(data.state);
      }
    };
  }, []);

  const run = async () => {
    if (!prompt || running) return;

    const currentPrompt = prompt;
    setPrompt("");
    setRunning(true);

    // Add user message immediately
    setMessages(prev => [...prev, {
      role: "user",
      content: currentPrompt
    }]);

    try {
      const res = await fetch("http://localhost:3000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt, auto: true })
      });

      const data = await res.json();

      if (data.type === "chat") {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.message
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${err.message}`
      }]);
    }

    setRunning(false);
  };

  return (
    <div className="h-screen flex flex-col bg-black text-gray-100 font-mono">

      {/* HEADER */}
      <div className="border-b-4 border-white p-3 flex justify-between items-center bg-zinc-900">
        <div className="text-xl font-bold tracking-tighter">🧠 XENTARI</div>
        <div className="text-yellow-400 font-bold px-2 py-1 border-2 border-yellow-400 uppercase text-xs">
          AUTO ⚡
        </div>
      </div>

      {/* INPUT */}
      <div className="border-b-4 border-white p-3 flex gap-2 bg-zinc-900">
        <input
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          className="flex-1 bg-black border-2 border-white px-3 py-2 text-white outline-none focus:bg-zinc-800 transition-colors"
          placeholder="Ask Xentari..."
        />
      </div>

      {/* MAIN GRID */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — AGENT PANEL */}
        <div className="w-1/4 border-r-4 border-white p-4 overflow-auto scrollbar-hide">
          <div className="text-sm font-bold bg-white text-black px-2 py-1 mb-4 inline-block">
            AGENT
          </div>

          <div className="text-zinc-500 text-xs mb-4 uppercase tracking-widest">
            Context-aware mode active
          </div>

          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`p-3 border-2 ${m.role === "user" ? "border-blue-500 bg-blue-900/20" : "border-green-500 bg-green-900/20"}`}>
                <div className={`text-xs font-bold mb-1 ${m.role === "user" ? "text-blue-400" : "text-green-400"}`}>
                  {m.role === "user" ? "YOU" : "XENTARI"}
                </div>
                <div className="leading-relaxed">{m.content}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER — MAIN VIEW */}
        <div className="w-2/4 p-4 overflow-auto">
          <div className="text-sm font-bold bg-white text-black px-2 py-1 mb-4 inline-block">
            OUTPUT
          </div>

          <div className="bg-zinc-900 border-2 border-white p-4">
            <div className="text-zinc-400 text-xs mb-1">EXECUTION ENGINE</div>
            <div className="text-xl">
              STATUS: <span className={state.status?.text === "SUCCESS" ? "text-green-400" : "text-red-400"}>{state.status?.text}</span>
            </div>

            {state.status?.text === "SUCCESS" && (
              <div className="mt-4 text-green-400 font-bold border-t border-green-900 pt-2 animate-pulse">
                ✔ Execution Complete
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — CONTEXT PANEL */}
        <div className="w-1/4 border-l-4 border-white p-4 overflow-auto bg-zinc-900">
          <div className="text-sm font-bold bg-white text-black px-2 py-1 mb-4 inline-block">
            CONTEXT
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-400">STACK:</span>
              <span className="text-white font-bold">{state.stack}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-400">PHASE:</span>
              <span className="text-white font-bold">{state.phase}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-400">MODE:</span>
              <span className="text-white font-bold">{state.mode}</span>
            </div>
          </div>

          <div className="mt-8">
            <div className="text-zinc-500 text-xs mb-2 font-bold uppercase tracking-widest">Model Metrics</div>
            <div className="bg-black border-2 border-zinc-700 p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Tokens:</span>
                <span className="text-white">{state.metrics?.totalTokens ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">TPS:</span>
                <span className="text-white">{state.metrics?.tokensPerSecond ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Latency:</span>
                <span className="text-white">{state.metrics?.latencyMs ?? "-"} ms</span>
              </div>
              <div className="pt-2 mt-2 border-t border-zinc-800 text-[10px] text-zinc-600 truncate">
                PROV: {state.metrics?.provider ?? "unknown"}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function getTraceColor(type) {
  switch (type) {
    case "OK": return "text-green-400";
    case "FAIL": return "text-red-400";
    case "STEP": return "text-gray-400";
    case "RETRY": return "text-yellow-400";
    default: return "";
  }
}
