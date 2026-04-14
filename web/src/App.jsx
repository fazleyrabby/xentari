import { useEffect, useState, useRef } from "react";

const PHASE_LABELS = {
  thinking: "Thinking",
  planning: "Planning solution",
  executing: "Executing steps",
  responding: "Generating response"
};

export default function App() {
  const [state, setState] = useState({});
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [config, setConfig] = useState({ projectDir: "", model: "", apiUrl: "" });
  const [session, setSession] = useState({ id: "default", messages: [], activeProjectId: null });
  const [sessions, setSessions] = useState(["default"]);
  const [projects, setProjects] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [newProjectPath, setNewProjectPath] = useState("");
  const [currentPhase, setCurrentPhase] = useState(null);

  const bottomRef = useRef(null);
  const hiddenPickerRef = useRef(null);

  // --- API Sync ---
  const fetchConfig = async () => {
    try {
      const res = await fetch("http://localhost:3000/config");
      const data = await res.json();
      setConfig(prev => ({
        ...prev,
        ...data,
        projectDir: data.projectDir || "",
        model: data.model || "",
        apiUrl: data.apiUrl || ""
      }));
    } catch (err) {}
  };

  const saveConfig = async (newCfg) => {
    await fetch("http://localhost:3000/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCfg || config)
    });
    fetchConfig();
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/projects");
      const list = await res.json();
      setProjects(list);
    } catch (err) {}
  };

  const fetchModels = async (force = false) => {
    try {
      const res = await fetch(`http://localhost:3000/api/models${force ? "?refresh=true" : ""}`);
      const data = await res.json();
      setAvailableModels(data.models || []);
      setAvailableProviders(data.providers || []);
    } catch (err) {}
  };

  const fetchSession = async (id = "default") => {
    try {
      const res = await fetch(`http://localhost:3000/session/${id}`);
      const data = await res.json();
      setSession(data);
    } catch (err) {}
  };

  // --- Handlers ---
  const run = async () => {
    if (!prompt.trim() || running) return;

    const currentPrompt = prompt;
    const userMsg = { role: "user", content: currentPrompt };
    const historyBefore = [...session.messages, userMsg];
    
    setSession(prev => ({ ...prev, messages: historyBefore }));
    setPrompt("");
    setRunning(true);
    setCurrentPhase("thinking");

    try {
      const res = await fetch("http://localhost:3000/run/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: currentPrompt, 
          messages: historyBefore 
        })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      let fullAIContent = "";
      
      // Update planning phase briefly
      setTimeout(() => setCurrentPhase("planning"), 1200);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.replace("data:", "").trim();
          if (jsonStr === "[DONE]") break;

          try {
            const data = JSON.parse(jsonStr);
            
            if (data.error) throw new Error(data.error);
            
            if (data.fullText !== undefined) {
              setCurrentPhase("responding");
              fullAIContent = data.fullText;
              
              // Update message list in real-time
              const aiMsg = { role: "assistant", content: fullAIContent };
              setSession(prev => ({
                ...prev,
                messages: [...historyBefore, aiMsg]
              }));

              // Update metrics sidebar
              setState(prev => ({
                ...prev,
                metrics: {
                  ...prev.metrics,
                  latencyMs: data.latency,
                  tokensPerSecond: data.tps?.toFixed(1),
                  totalTokens: data.tokens,
                  provider: config.model?.split(":")[0] || "N/A"
                }
              }));
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      setSession(prev => ({
        ...prev, 
        messages: [...historyBefore, { role: "assistant", content: `❌ Error: ${err.message}` }]
      }));
    } finally {
      setRunning(false);
      setCurrentPhase(null);
    }
  };

  const registerProject = async () => {
    if (!newProjectPath) return;
    try {
      await fetch("http://localhost:3000/api/projects/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newProjectPath })
      });
      fetchProjects();
      setNewProjectPath("");
    } catch (err) {}
  };

  const setProject = (p) => {
    const newCfg = { ...config, projectDir: p.path };
    setConfig(newCfg);
    saveConfig(newCfg);
  };

  // --- Lifecycle ---
  useEffect(() => {
    fetchConfig();
    fetchProjects();
    fetchModels();
    fetchSession();

    const poll = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:3000/state");
        const data = await res.json();
        setState(data.state);
      } catch (err) {}
    }, 1000);

    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages, currentPhase]);

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-gray-300">
      
      {/* LEFT SIDEBAR — EXPLORER */}
      <div className="w-64 border-r border-zinc-900 flex flex-col bg-zinc-950/50">
        <div className="p-4 border-b border-zinc-900 flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Workspace</span>
          <button onClick={() => setShowSettings(!showSettings)} className="hover:text-white">
            <SettingsIcon />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div>
            <div className="text-[9px] uppercase text-zinc-600 px-2 mb-2 tracking-tighter">Projects</div>
            {projects.map(p => (
              <div 
                key={p.id} 
                onClick={() => setProject(p)}
                className={`sidebar-item rounded ${config.projectDir === p.path ? 'active' : ''}`}
              >
                <FolderIcon />
                <span className="truncate">{p.name}</span>
              </div>
            ))}
            <div className="mt-2 px-2">
               <button 
                  onClick={() => {
                    const path = prompt("Enter local project path:");
                    if (path) {
                      setNewProjectPath(path);
                      registerProject();
                    }
                  }}
                  className="w-full border border-zinc-800 border-dashed py-1 text-[9px] hover:bg-zinc-900 text-zinc-500"
               >
                 + ADD LOCAL
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN — CHAT AREA */}
      <div className="flex-1 flex flex-col relative bg-zinc-950">
        
        {/* HEADER */}
        <div className="h-12 border-b border-zinc-900 flex items-center justify-between px-4 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-xs tracking-widest italic">XENTARI</span>
            <span className="text-[10px] text-zinc-600">/</span>
            <span className="text-[11px] text-zinc-400 font-medium truncate max-w-sm">
              {config.projectDir?.split("/").pop() || "Select Project"}
            </span>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-[10px] flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                <div className={`w-1.5 h-1.5 rounded-full ${availableModels.length > 0 ? 'bg-green-500 shadow-[0_0_5px_green]' : 'bg-red-500'}`} />
                <span className="text-zinc-400">{config.model?.split(":")[0] || "No Model"}</span>
             </div>
          </div>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 max-w-4xl mx-auto w-full">
          {session.messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 pt-32">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                <span className="text-2xl">⚡</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">How can I help you today?</h1>
              <p className="text-zinc-500 text-xs max-w-xs leading-relaxed">
                Connect to local models, scan your project context, and build deterministic code.
              </p>
            </div>
          )}

          {session.messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`chat-bubble ${m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                {m.content}
              </div>
            </div>
          ))}

          {currentPhase && (
            <div className="flex flex-col items-start animate-fade-in">
              <div className="chat-bubble chat-bubble-assistant text-zinc-500 flex items-center gap-2 italic">
                <span className="agent-dot" />
                {PHASE_LABELS[currentPhase]}...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* INPUT BAR */}
        <div className="p-4 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
          <div className="max-w-4xl mx-auto relative group">
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  run();
                }
              }}
              placeholder="Ask anything..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 pb-12 text-sm focus:outline-none focus:border-zinc-600 transition-all resize-none min-h-[56px] shadow-2xl"
              style={{ maxHeight: '200px' }}
            />
            <div className="absolute bottom-3 left-4 flex items-center gap-2">
               <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">Enter to send</span>
            </div>
            <button 
              onClick={run}
              disabled={running || !prompt.trim()}
              className={`absolute bottom-3 right-3 p-2 rounded-lg transition-all ${running || !prompt.trim() ? 'bg-zinc-800 text-zinc-600' : 'bg-white text-black hover:scale-105'}`}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT — CONTEXT PANEL */}
      <div className="w-80 border-l border-zinc-900 bg-zinc-950/50 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-900">
           <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Inference stats</span>
        </div>
        <div className="p-4 space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <div className="text-[9px] uppercase text-zinc-600 tracking-tight">Latency</div>
                 <div className="text-lg font-bold text-white tabular-nums">{state.metrics?.latencyMs ?? "-"} <span className="text-[9px] text-zinc-700">ms</span></div>
              </div>
              <div className="space-y-1">
                 <div className="text-[9px] uppercase text-zinc-600 tracking-tight">Speed</div>
                 <div className="text-lg font-bold text-white tabular-nums">{state.metrics?.tokensPerSecond ?? "-"} <span className="text-[9px] text-zinc-700">TPS</span></div>
              </div>
           </div>

           <div className="space-y-2">
              <div className="text-[9px] uppercase text-zinc-600 tracking-tight">Usage</div>
              <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-zinc-500 transition-all duration-1000" 
                   style={{ width: `${Math.min(100, (state.metrics?.totalTokens || 0) / 10)}%` }}
                 />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
                 <span>{state.metrics?.totalTokens ?? 0} tokens used</span>
                 <span>{state.metrics?.provider || "N/A"}</span>
              </div>
           </div>

           <div className="pt-4 border-t border-zinc-900 space-y-3">
              <div className="text-[9px] uppercase text-zinc-600 tracking-tight">System state</div>
              <div className="space-y-2">
                 {[
                   { label: "Stack", value: state.stack || "NODE" },
                   { label: "Phase", value: state.phase || "IDLE" },
                   { label: "Mode", value: state.mode || "SAFE" }
                 ].map(item => (
                   <div key={item.label} className="flex justify-between items-center text-[10px]">
                      <span className="text-zinc-500">{item.label}</span>
                      <span className="text-zinc-300 font-bold bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{item.value}</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white tracking-widest uppercase italic">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-zinc-500 font-bold">Model Endpoint</label>
                <input 
                  type="text"
                  value={config.apiUrl}
                  onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                  className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs focus:border-zinc-600 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-zinc-500 font-bold">Active Model</label>
                <select 
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs focus:border-zinc-600 transition-all text-zinc-300"
                >
                  <option value="">Select a model</option>
                  {availableModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                  ))}
                </select>
                <button 
                  onClick={() => fetchModels(true)}
                  className="text-[9px] text-zinc-600 hover:text-white underline"
                >
                  Refresh models list
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={() => {
                  saveConfig();
                  setShowSettings(false);
                }}
                className="w-full bg-white text-black font-bold py-2 rounded-lg text-xs hover:bg-zinc-200 transition-all"
              >
                SAVE CHANGES
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Icons ---
function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
    </svg>
  );
}
