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
  const [session, setSession] = useState({ id: "default", messages: [], activeProjectId: null });
  const [sessions, setSessions] = useState(["default"]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [availableModels, setAvailableModels] = useState([]);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [newProjectPath, setNewProjectPath] = useState("");
  const [showAddProject, setShowAddProject] = useState(false);

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
    fetchSessions();
    fetchDiscovery();
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/projects");
      setProjects(await res.json());
    } catch (err) {}
  };

  const addProject = async (path) => {
    try {
      await fetch("http://localhost:3000/api/projects/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path })
      });
      fetchProjects();
    } catch (err) {}
  };

  const removeProject = async (id) => {
    try {
      await fetch(`http://localhost:3000/api/projects/${id}`, { method: "DELETE" });
      fetchProjects();
    } catch (err) {}
  };

  const selectProject = async (projectId) => {
    try {
      const res = await fetch("http://localhost:3000/session/set-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, projectId })
      });
      const updatedSession = await res.json();
      setSession(updatedSession);
      fetchConfig();
    } catch (err) {}
  };

  const fetchDiscovery = async (force = false) => {
    try {
      const res = await fetch(`http://localhost:3000/api/models${force ? "?refresh=true" : ""}`);
      const data = await res.json();
      setAvailableModels(data.models || []);
      setAvailableProviders(data.providers || []);
    } catch (err) {}
  };

  useEffect(() => {
    if (session.messages.length > 0) {
      saveChat(session);
    }
  }, [session.messages]);

  const fetchSessions = async () => {
    try {
      const res = await fetch("http://localhost:3000/session/list");
      const list = await res.json();
      if (list.length > 0) setSessions(list);
    } catch (err) {}
  };

  const loadChat = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/session/load/${id}`);
      const data = await res.json();
      setSession(data);
    } catch (err) {}
  };

  const saveChat = async (s) => {
    await fetch("http://localhost:3000/session/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: s })
    });
  };

  const createNewSession = async () => {
    try {
      const res = await fetch("http://localhost:3000/session/create", { method: "POST" });
      const newSession = await res.json();
      setSession(newSession);
      fetchSessions();
    } catch (err) {}
  };

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
    if (!prompt.trim() || running) return;

    const currentPrompt = prompt;
    setPrompt("");
    setRunning(true);

    // Add user message to session
    const userMsg = { role: "user", content: currentPrompt };
    setSession(prev => ({ ...prev, messages: [...prev.messages, userMsg] }));

    try {
      const res = await fetch("http://localhost:3000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt, auto: true })
      });

      const data = await res.json();

      if (data.type === "chat") {
        const aiMsg = { role: "assistant", content: data.message };
        setSession(prev => ({ ...prev, messages: [...prev.messages, aiMsg] }));
      }
    } catch (err) {
      const errMsg = { role: "assistant", content: `Error: ${err.message}` };
      setSession(prev => ({ ...prev, messages: [...prev.messages, errMsg] }));
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
          list="model-list"
          className="bg-black border border-gray-700 px-2 py-1 text-xs text-gray-300 w-1/4 outline-none focus:border-blue-500"
        />
        <datalist id="model-list">
          {availableModels.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
          ))}
        </datalist>

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

        <button 
          onClick={() => fetchDiscovery(true)}
          className="bg-zinc-800 hover:bg-zinc-700 text-gray-400 text-[10px] font-bold px-3 py-1 uppercase tracking-widest transition-colors border border-gray-700"
          title="Refresh available models"
        >
          ↻
        </button>

        <div className="h-4 w-px bg-gray-700 mx-1"></div>

        <select 
          value={session.id}
          onChange={(e) => {
            if (e.target.value === "new") createNewSession();
            else loadChat(e.target.value);
          }}
          className="bg-black border border-gray-700 px-2 py-1 text-[10px] text-gray-400 outline-none"
        >
          {sessions.map(s => <option key={s} value={s}>{s === "default" ? "Session: Default" : `Session: ${s.slice(0, 8)}`}</option>)}
          <option value="new">+ New Session</option>
        </select>

        <input
          placeholder="Search chat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-black border border-gray-700 px-2 py-1 text-[10px] text-gray-400 outline-none w-32 focus:border-white"
        />
      </div>

      {/* MAIN GRID */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL: WORKSPACE */}
        <div className="w-1/4 border-r border-gray-700 flex flex-col overflow-hidden bg-zinc-950">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-zinc-900">
            <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">WORKSPACE</span>
            <button 
                onClick={() => setShowAddProject(!showAddProject)}
                className="bg-zinc-800 p-1 hover:bg-zinc-700 text-gray-400 border border-gray-700 text-[10px] font-bold px-2"
            >
              PROJECT +
            </button>
          </div>
          
          {showAddProject && (
            <div className="p-4 border-b border-gray-800 bg-black animate-in fade-in slide-in-from-top-2 duration-200">
               <div className="text-zinc-600 text-[9px] uppercase font-bold mb-2 tracking-widest">Add Local Project</div>
               
               <div className="flex flex-col gap-2">
                  <div className="flex gap-1">
                    <button 
                      className="bg-zinc-800 p-1 hover:bg-zinc-700 text-gray-400 border border-gray-700 text-[10px] w-full"
                      onClick={async () => {
                        try {
                          const handle = await window.showDirectoryPicker();
                          const folderName = handle.name;
                          const platform = navigator.platform.toLowerCase();
                          let base = "/Users/";
                          if (platform.includes("win")) base = "C:\\Users\\";
                          else if (!platform.includes("mac")) base = "/home/";
                          setNewProjectPath(`${base}user/${folderName}`);
                        } catch (err) {
                          if (err.name !== "AbortError") {
                            document.getElementById("hidden-picker").click();
                          }
                        }
                      }}
                    >
                      BROWSE...
                    </button>
                    <input 
                      type="file" 
                      id="hidden-picker"
                      webkitdirectory="true" 
                      directory="true"
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          const folderName = files[0].webkitRelativePath.split("/")[0];
                          const platform = navigator.platform.toLowerCase();
                          let base = "/Users/";
                          if (platform.includes("win")) base = "C:\\Users\\";
                          else if (!platform.includes("mac")) base = "/home/";
                          setNewProjectPath(`${base}user/${folderName}`);
                        }
                      }}
                    />
                  </div>

                  <input 
                    type="text"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                    placeholder="/absolute/path/to/project"
                    className="bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-blue-500 w-full"
                  />

                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        if (newProjectPath) {
                          addProject(newProjectPath);
                          setNewProjectPath("");
                          setShowAddProject(false);
                        }
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold p-1 uppercase tracking-widest"
                    >
                      REGISTER
                    </button>
                    <button 
                      onClick={() => setShowAddProject(false)}
                      className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 text-[10px] font-bold px-2"
                    >
                      ✕
                    </button>
                  </div>
               </div>
            </div>
          )}
          
          <div className="flex-1 overflow-auto p-4 space-y-2">
             {projects.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => selectProject(p.id)}
                  className={`p-3 border border-zinc-800 cursor-pointer group hover:border-blue-500 transition-all ${
                    session.activeProjectId === p.id ? "bg-blue-900/10 border-blue-500/50" : "bg-black"
                  }`}
                >
                   <div className="flex justify-between items-center">
                      <div className="truncate pr-2">
                        <div className="font-bold text-xs uppercase tracking-tight text-zinc-300">{p.name}</div>
                        <div className="text-[9px] text-zinc-600 truncate">{p.path}</div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeProject(p.id); }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-500 text-[10px] transition-opacity"
                      >
                        ✕
                      </button>
                   </div>
                </div>
             ))}

             {projects.length === 0 && (
                <div className="text-center py-8">
                   <div className="text-zinc-700 text-[10px] uppercase font-bold mb-2 tracking-widest">No Projects</div>
                   <div className="text-zinc-800 text-[9px] px-4 leading-relaxed italic">Select a folder to begin agentic development.</div>
                </div>
             )}
          </div>
        </div>

        {/* AGENT PANEL */}
        <div className="w-1/4 border-r border-gray-700 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-700 bg-zinc-900 text-xs font-bold uppercase tracking-widest text-gray-400">
            AGENT
          </div>
          
          <div className="flex-1 overflow-auto p-3 scrollbar-hide">
            {!session.messages.length && (
              <div className="text-gray-600 text-sm italic">
                Awaiting instructions...
              </div>
            )}

            <div className="space-y-3">
              {session.messages
                .filter(m => !search || m.content.toLowerCase().includes(search.toLowerCase()))
                .map((m, i) => (
                <div key={i} className={`p-3 border ${
                  m.role === "user"
                    ? "border-blue-500 bg-blue-950"
                    : "border-green-500 bg-green-950"
                }`}>
                  <div className={`text-[10px] text-gray-400 mb-1 font-bold uppercase tracking-tighter`}>
                  {m.role === "user" ? "YOU" : "XENTARI (AI)"}
                </div>
                  <div className="text-sm leading-relaxed text-zinc-200">{m.content}</div>
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
