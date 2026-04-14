import { useEffect, useState, useRef } from "react";

export default function App() {
  const [state, setState] = useState({});
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState([]);
  const [config, setConfig] = useState({
    projectDir: "",
    model: "",
    apiUrl: ""
  });
  const bottomRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000");

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "STATE_UPDATE") {
        setState(data.state);
      }
    };

    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch("http://localhost:3000/config");
      const data = await res.json();
      setConfig(data);
    } catch (err) {}
  };

  const saveConfig = async () => {
    await fetch("http://localhost:3000/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

      {/* WARNING BANNER */}
      {(!config.apiUrl || !config.model) && (
        <div className="bg-yellow-900/50 text-yellow-500 p-2 text-[10px] font-bold border-b border-yellow-900 flex justify-between items-center px-4 uppercase tracking-widest">
          <span>⚠ Model not configured. Set API & Model in settings.</span>
          <span className="text-gray-400">SAFE MODE ACTIVE</span>
        </div>
      )}

      {/* HEADER */}
      <div className="border-b border-gray-700 p-3 flex justify-between bg-black items-center">
        <div>
          <div className="font-bold uppercase tracking-tighter">🧠 XENTARI</div>
          <div className="text-[10px] text-gray-500 uppercase truncate max-w-[300px]">
            {config.projectDir || "No project selected"}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {(!config.apiUrl || !config.model) && (
            <button 
              onClick={() => document.getElementById("config-bar").scrollIntoView({ behavior: "smooth" })}
              className="text-yellow-500 border border-yellow-500 px-2 py-0.5 text-[9px] font-bold uppercase hover:bg-yellow-500 hover:text-black transition-all"
            >
              Configure
            </button>
          )}
          <div className="text-yellow-400 font-bold uppercase text-[10px] px-2 py-1 border border-yellow-400">
            AUTO ⚡
          </div>
        </div>
      </div>

      {/* TOP SETTINGS BAR */}
      <div id="config-bar" className="border-b border-gray-700 p-2 flex gap-2 bg-zinc-900 items-center">
        <input
          placeholder="Project Path (/Users/...)"
          value={config.projectDir}
          onChange={(e) => setConfig({...config, projectDir: e.target.value})}
          className="bg-black border border-gray-700 px-2 py-1 text-xs text-gray-300 w-1/3 outline-none focus:border-blue-500"
        />

        <input
          placeholder="Model (qwen, llama, gpt-4)"
          value={config.model}
          onChange={(e) => setConfig({...config, model: e.target.value})}
          className="bg-black border border-gray-700 px-2 py-1 text-xs text-gray-300 w-1/4 outline-none focus:border-blue-500"
        />

        <input
          placeholder="API URL (http://localhost:11434)"
          value={config.apiUrl}
          onChange={(e) => setConfig({...config, apiUrl: e.target.value})}
          className="bg-black border border-gray-700 px-2 py-1 text-xs text-gray-300 w-1/4 outline-none focus:border-blue-500"
        />

        <button 
          onClick={saveConfig}
          className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest transition-colors"
        >
          Apply
        </button>
      </div>

      {/* MAIN GRID */}
      <div className="flex flex-1 overflow-hidden gap-0">

        {/* LEFT — AGENT PANEL */}
        <div className="w-1/4 border-r border-gray-700 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-700 bg-zinc-900 text-xs font-bold uppercase tracking-widest text-gray-400">
            AGENT
          </div>
          
          <div className="flex-1 overflow-auto p-3 scrollbar-hide">
            <div className="text-gray-500 text-[10px] mb-4 uppercase tracking-widest">
              Context-aware mode active
            </div>

            {!messages.length && (
              <div className="text-gray-600 text-sm italic">
                Start by asking something...
              </div>
            )}

            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`p-3 border ${
                  m.role === "user"
                    ? "border-blue-500 bg-blue-950"
                    : "border-green-500 bg-green-950"
                }`}>
                  <div className={`text-[10px] text-gray-400 mb-1 font-bold uppercase tracking-tighter`}>
                  {m.role === "user" ? "YOU" : "XENTARI (AI)"}
                </div>
                  <div className="text-sm leading-relaxed">{m.content}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* STICKY INPUT BAR */}
          <div className="border-t border-gray-700 p-2 bg-black">
            <input
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              className="w-full bg-zinc-900 border border-gray-600 px-3 py-2 text-sm text-white outline-none focus:border-white transition-colors"
              placeholder="Type a message..."
            />
          </div>
        </div>

        {/* CENTER — MAIN VIEW */}
        <div className="w-2/4 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-700 bg-zinc-900 text-xs font-bold uppercase tracking-widest text-gray-400">
            OUTPUT
          </div>
          
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center">
             {state.status?.text === "READY" && (
                <div className="text-gray-600 text-sm">System ready for tasks</div>
             )}

             {state.status?.text?.includes("FAILED") && (
                <div className="border border-red-500 p-4 bg-red-950/20 text-red-500 font-bold w-full max-w-md text-center uppercase tracking-tighter">
                  ✖ FAILED — {state.status.text.split(":")[1] || "UNKNOWN ERROR"}
                </div>
             )}

             {state.status?.text === "SUCCESS" && (
                <div className="border border-green-500 p-4 bg-green-950/20 text-green-500 font-bold w-full max-w-md text-center uppercase tracking-tighter">
                  ✔ SUCCESS
                </div>
             )}

             {state.status?.text === "RUNNING" && (
                <div className="border border-blue-500 p-4 bg-blue-950/20 text-blue-500 font-bold w-full max-w-md text-center animate-pulse uppercase tracking-tighter">
                  ▶ RUNNING
                </div>
             )}
          </div>
        </div>

        {/* RIGHT — CONTEXT PANEL */}
        <div className="w-1/4 border-l border-gray-700 bg-zinc-950 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-700 bg-zinc-900 text-xs font-bold uppercase tracking-widest text-gray-400">
            CONTEXT
          </div>

          <div className="p-4 space-y-3 text-xs">
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-500">STACK</span>
              <span className="text-gray-100 font-bold">{state.stack || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-500">PHASE</span>
              <span className="text-gray-100 font-bold">{state.phase || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-500">MODE</span>
              <span className="text-gray-100 font-bold uppercase">{state.mode || "SAFE"}</span>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-800">
              <div className="text-gray-500 font-bold mb-3 uppercase tracking-widest text-[10px]">Model Performance</div>
              
              <div className="mb-4 bg-black border border-zinc-800 p-2 text-[10px]">
                <div className="text-zinc-600 mb-1">ACTIVE MODEL</div>
                <div className="text-gray-200 font-bold">{config.model || "N/A"}</div>
                <div className="text-zinc-700 truncate">{config.apiUrl || "NOT CONFIGURED"}</div>
                {(!config.model || !config.apiUrl) && (
                  <div className="mt-2 text-red-500 font-bold animate-pulse uppercase">
                    ⚠ Model not ready
                  </div>
                )}
              </div>

              <div className="space-y-4">
                 <div className="flex flex-col">
                    <span className="text-zinc-600 text-[10px]">LATENCY</span>
                    <span className="text-gray-200 text-lg">{state.metrics?.latencyMs ?? "-"} <span className="text-[10px]">ms</span></span>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-zinc-600 text-[10px]">SPEED</span>
                    <span className="text-gray-200 text-lg">{state.metrics?.tokensPerSecond ?? "-"} <span className="text-[10px]">TPS</span></span>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-zinc-600 text-[10px]">USAGE</span>
                    <span className="text-gray-200 text-lg">{state.metrics?.totalTokens ?? "-"} <span className="text-[10px]">TKN</span></span>
                 </div>
                 <div className="pt-2 text-[9px] text-zinc-700 uppercase">
                    Provider: {state.metrics?.provider || "N/A"}
                 </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
