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

    setRunning(true);

    const res = await fetch("http://localhost:3000/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, auto: true })
    });

    const data = await res.json();

    if (data.type === "chat") {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.message
      }]);
    }

    setMessages(prev => [...prev, {
      role: "user",
      content: prompt
    }]);

    setPrompt("");
    setRunning(false);
  };

  return (
    <div className="h-screen flex flex-col">

      {/* HEADER */}
      <div className="border-b border-gray-700 p-2 flex justify-between">
        <div>🧠 XENTARI</div>
        <div className="text-yellow-400">AUTO ⚡</div>
      </div>

      {/* INPUT */}
      <div className="border-b border-gray-700 p-2 flex gap-2">
        <input
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          className="flex-1 bg-black border border-gray-600 px-2 py-1"
          placeholder="Ask Xentari..."
        />
      </div>

      {/* MAIN GRID */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — AGENT PANEL */}
        <div className="w-1/4 border-r border-gray-700 p-2 overflow-auto">

          <div className="border-b border-gray-700 mb-2 pb-1">
            AGENT
          </div>

          <div className="text-gray-500 text-xs mb-2">
            Context-aware mode active
          </div>

          {messages.map((m, i) => (
            <div key={i} className="mb-2">
              <div className="text-gray-500">
                {m.role === "user" ? "YOU" : "XENTARI"}
              </div>
              <div>{m.content}</div>
            </div>
          ))}

        </div>

        {/* CENTER — MAIN VIEW */}
        <div className="w-2/4 p-2 overflow-auto">
          <div className="border-b border-gray-700 mb-2 pb-1">
            OUTPUT
          </div>

          <div>
            STATUS: {state.status?.text}
          </div>

          <div className="mt-2 text-green-400">
            {state.status?.text === "SUCCESS" && "✔ Execution Complete"}
          </div>
        </div>

        {/* RIGHT — CONTEXT PANEL */}
        <div className="w-1/4 border-l border-gray-700 p-2 overflow-auto">
          <div className="border-b border-gray-700 mb-2 pb-1">
            CONTEXT
          </div>

          <div>STACK: {state.stack}</div>
          <div>PHASE: {state.phase}</div>
          <div>MODE: {state.mode}</div>
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
