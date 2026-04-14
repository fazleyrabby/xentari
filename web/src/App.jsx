import { useEffect, useState } from "react";

export default function App() {
  const [state, setState] = useState({});
  const [prompt, setPrompt] = useState("");

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
    await fetch("http://localhost:3000/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });
  };

  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>🧠 Xentari Web</h1>

      <div style={{ marginBottom: 20 }}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter command (e.g. node -v)"
          style={{ width: "80%", padding: 8, marginRight: 10 }}
        />
        <button onClick={run} style={{ padding: 8 }}>Run</button>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, border: '1px solid #ccc', padding: 10 }}>
          <h3>State</h3>
          <pre style={{ fontSize: '12px' }}>{JSON.stringify(state, null, 2)}</pre>
        </div>
        
        <div style={{ flex: 1, border: '1px solid #ccc', padding: 10 }}>
          <h3>Trace</h3>
          <ul>
            {state.timeline?.map((t, i) => (
              <li key={i}>[{t.type}] {t.command || t.reason}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
