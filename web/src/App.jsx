import { useEffect, useState } from "react";

export default function App() {
  const [state, setState] = useState({});
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000");

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "STATE_UPDATE") {
        setState(data.state);
      }
    };

    return () => ws.close();
  }, []);

  const run = async () => {
    if (!prompt || running) return;

    setRunning(true);

    await fetch("http://localhost:3000/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, auto: true })
    });

    setPrompt("");
    setRunning(false);
  };

  return (
    <div className="h-screen flex flex-col bg-black text-gray-200 font-mono">
      {/* HEADER */}
      <div className="border-b border-gray-700 p-2 flex justify-between">
        <div>🧠 XENTARI</div>
        <div className="text-yellow-400">
          {state.mode === "AUTO" ? "AUTO ⚡" : state.mode || "SAFE"}
        </div>
      </div>

      {/* INPUT */}
      <div className="border-b border-gray-700 p-2 flex gap-2">
        <input
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          className="flex-1 bg-black border border-gray-600 px-2 py-1 outline-none focus:border-gray-400"
          placeholder="Ask Xentari..."
        />
        <button
          onClick={run}
          disabled={running}
          className="px-4 py-1 bg-gray-800 border border-gray-600 hover:bg-gray-700 disabled:opacity-50"
        >
          {running ? "..." : "Run"}
        </button>
      </div>

      {/* MAIN GRID */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — AGENT PANEL */}
        <div className="w-1/4 border-r border-gray-700 p-2 overflow-auto">
          <div className="border-b border-gray-700 mb-2 pb-1 text-gray-400">AGENT</div>

          {/* Actions */}
          {state.actions?.map((a, i) => (
            <div key={i} className="text-sm py-1">
              {a.icon} {a.type} {a.target}
            </div>
          ))}

          {/* Trace (thinking) */}
          <div className="mt-4 border-t border-gray-700 pt-2">
            <div className="text-gray-400 mb-1">THINKING</div>
            {state.timeline?.map((t, i) => (
              <div key={i} className={`text-sm py-1 ${getTraceColor(t.type)}`}>
                [{t.type}] {t.command || t.reason}
              </div>
            ))}
          </div>
        </div>

        {/* CENTER — MAIN VIEW */}
        <div className="w-2/4 p-2 overflow-auto">
          <div className="border-b border-gray-700 mb-2 pb-1 text-gray-400">
            OUTPUT
          </div>

          <div className="text-sm">
            STATUS: {state.status?.text || "READY"}
          </div>

          <div className="mt-2 text-green-400 text-sm">
            {state.status?.text === "SUCCESS" && "✔ Execution Complete"}
          </div>
        </div>

        {/* RIGHT — CONTEXT PANEL */}
        <div className="w-1/4 border-l border-gray-700 p-2 overflow-auto">
          <div className="border-b border-gray-700 mb-2 pb-1 text-gray-400">
            CONTEXT
          </div>

          <div className="text-sm space-y-2">
            <div>STACK: {state.stack || state.header?.stack || "NODE"}</div>
            <div>PHASE: {state.header?.phase || "IDLE"}</div>
            <div>MODE: {state.mode || "SAFE"}</div>
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
