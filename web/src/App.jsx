import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ContextPanel from "./components/ContextPanel";
import Timeline from "./components/Timeline";
import FileDrawer from "./components/FileDrawer";
import FileExplorer from "./components/FileExplorer";
import { parseCommand } from "./utils/parseCommand";
import { getCommandPrompt } from "./utils/commandPrompts";

const PHASE_LABELS = {
  thinking: "Thinking",
  planning: "Planning solution",
  executing: "Executing steps",
  responding: "Generating response",
  "scanning-project": "Scanning project",
  "analyzing-context": "Analyzing context"
};

export default function App() {
  const [state, setState] = useState({});
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [config, setConfig] = useState({ projectDir: "", model: "", baseUrl: "", projectId: "" });
  const [session, setSession] = useState({ id: "default", messages: [], activeProjectId: null });
  const [sessions, setSessions] = useState(["default"]);
  const [projects, setProjects] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [newProjectPath, setNewProjectPath] = useState("");
  const [currentPhase, setCurrentPhase] = useState(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [contextFiles, setContextFiles] = useState([]);
  const [showLeft, setShowLeft] = useState(true);
  const [showContext, setShowContext] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [timeline, setTimeline] = useState([]);
  const [activeCommand, setActiveCommand] = useState("chat");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [modifiedContent, setModifiedContent] = useState("");
  const [highlightLine, setHighlightLine] = useState(null);

  const bottomRef = useRef(null);
  const hiddenPickerRef = useRef(null);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/config");
      const data = await res.json();
      setConfig(prev => {
        const newCfg = {
          ...prev,
          ...data,
          projectDir: data.projectDir || prev.projectDir || "",
          model: data.model || prev.model || "",
          baseUrl: data.baseUrl || prev.baseUrl || "",
          projectId: prev.projectId || data.projectId || ""
        };
        if (newCfg.projectDir) fetchSession("default", newCfg.projectDir);
        return newCfg;
      });
    } catch (err) {}
  };

  const saveConfig = async (newCfg) => {
    await fetch("/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCfg || config)
    });
    fetchConfig();
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const list = await res.json();
      setProjects(list);
    } catch (err) {}
  };

  const fetchModels = async (force = false) => {
    try {
      const res = await fetch(`/api/models${force ? "?refresh=true" : ""}`);
      const data = await res.json();
      setAvailableModels(data.models || []);
      setAvailableProviders(data.providers || []);
    } catch (err) {}
  };

  const fetchSession = async (id = "default", projectDir) => {
    try {
      const dir = projectDir || config.projectDir;
      const res = await fetch(`/session/load/${id}?projectDir=${encodeURIComponent(dir || "")}`);
      const data = await res.json();
      setSession(data);
    } catch (err) {}
  };

  const bufferRef = useRef("");

  const runAgent = async (options) => {
    const text = typeof options === "string" ? options : (options?.input ?? prompt);
    if (!text.trim() || running) return;

    if (!config.projectDir) {
      setSession(prev => ({
        ...prev,
        messages: [...prev.messages, { role: "user", content: text }, { role: "assistant", content: "❌ Error: Please select a project first." }]
      }));
      return;
    }

    if (!config.model) {
      setSession(prev => ({
        ...prev,
        messages: [...prev.messages, { role: "user", content: text }, { role: "assistant", content: "❌ Error: Please select a model in Settings." }]
      }));
      return;
    }

    const command = parseCommand(text);
    const commandType = (typeof options === "object" && options?.meta?.command) || command.type;

    const currentPrompt = command.type === "chat"
      ? command.query
      : getCommandPrompt(command.type, command.query);

    if (typeof options === "string" || !options) { setPrompt(""); setActiveCommand("chat"); }
    const userMsg = { role: "user", content: currentPrompt };
    const historyBefore = [...session.messages, userMsg];

    setSession(prev => ({ ...prev, messages: historyBefore }));
    setRunning(true);
    bufferRef.current = "";
    setContextFiles([]);
    setTimeline([]);

    const projectPath = config.projectDir || "";
    const url = `/chat/stream?input=${encodeURIComponent(currentPrompt)}&projectPath=${encodeURIComponent(projectPath)}&command=${encodeURIComponent(commandType)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "status") {
          if (data.message === "generating response") {
            setCurrentPhase("responding");
          } else {
            setCurrentPhase(data.message.replace(" ", "-"));
          }
          setTimeline(prev => [...prev, { message: data.message, time: Date.now() }]);
        }

        if (data.type === "chunk") {
          bufferRef.current += data.content;
          const aiMsg = { role: "assistant", content: bufferRef.current };
          setSession(prev => ({
            ...prev,
            messages: [...historyBefore, aiMsg]
          }));

          // Simple code block detection for diff
          const match = bufferRef.current.match(/```(?:\w+)?\n([\s\S]+?)```/);
          if (match && match[1] && selectedFile) {
            setModifiedContent(match[1].trim());
          }
        }

        if (data.type === "context") {
          setContextFiles(data.files || []);
        }

        if (data.type === "metrics") {
          setState(prev => ({ ...prev, metrics: data.metrics }));
        }

        if (data.type === "done" || data.type === "error") {
          if (data.type === "error") {
             setSession(prev => ({
                ...prev,
                messages: [...historyBefore, { role: "assistant", content: `❌ Error: ${data.message}` }]
             }));
          }
          eventSource.close();
          setRunning(false);
          setCurrentPhase(null);
        }
      } catch (e) {
        console.error("SSE Parse Error", e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setRunning(false);
      setCurrentPhase(null);
      setSession(prev => ({
        ...prev,
        messages: [...prev.messages, { role: "assistant", content: "❌ Error: Failed to connect to server stream. Ensure the backend is running at http://localhost:3000" }]
      }));
    };
  };

  const registerProject = async () => {
    if (!newProjectPath) return;
    try {
      await fetch("/api/projects/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newProjectPath })
      });
      fetchProjects();
      setNewProjectPath("");
    } catch (err) {}
  };

  const setProject = (p) => {
    const newCfg = { ...config, projectDir: p.path, projectId: p.id };
    setConfig(newCfg);
    saveConfig(newCfg);
  };

  const openFile = async (filePath) => {
    setSelectedFile(filePath);
    setFileContent("");
    setModifiedContent("");
    setHighlightLine(null);
    try {
      const res = await fetch(`/api/file?projectId=${config.projectId}&path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      setFileContent(data.content || data.error || "");
      setHighlightLine(data.matchLine ?? null);
    } catch {
      setFileContent("Failed to load file.");
    }
  };

  const applyChanges = async (newContent) => {
    try {
      const res = await fetch("/api/file/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: config.projectId,
          path: selectedFile,
          content: newContent
        })
      });
      const data = await res.json();
      if (data.success) {
        setFileContent(newContent);
        setModifiedContent("");
        alert("Changes applied successfully!");
      }
    } catch (err) {
      alert("Failed to apply changes: " + err.message);
    }
  };

  const deleteProject = async (id) => {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      fetchProjects();
    } catch (err) {}
  };

  useEffect(() => {
    fetchConfig();
    fetchProjects();
    fetchModels();

    const poll = setInterval(async () => {
      try {
        const res = await fetch("/state");
        const data = await res.json();
        if (data) setState(data);
      } catch (err) {}
    }, 1000);

    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages, currentPhase]);

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-gray-300 overflow-hidden">
      
      {/* LEFT SIDEBAR — EXPLORER */}
      <div className={`flex-shrink-0 border-r border-zinc-900 flex flex-col bg-zinc-950/50 transition-all duration-200 overflow-hidden ${showLeft ? 'w-56' : 'w-0'}`}>
        <div className="p-4 border-b border-zinc-900 flex justify-between items-center min-w-[224px]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Workspace</span>
          <button onClick={() => setShowSettings(!showSettings)} className="hover:text-white">
            <SettingsIcon />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4 min-w-[224px]">
          <div>
            <div className="text-[9px] uppercase text-zinc-600 px-2 mb-2 tracking-tighter">Projects</div>
            {projects.map(p => (
              <div 
                key={p.id} 
                className={`sidebar-item group rounded flex items-center justify-between ${config.projectDir === p.path ? 'active' : ''}`}
              >
                <div onClick={() => setProject(p)} className="flex items-center gap-2 flex-1 cursor-pointer truncate">
                  <FolderIcon />
                  <span className="truncate">{p.name}</span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Remove ${p.name} from workspace?`)) {
                      deleteProject(p.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 px-1 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="mt-2 px-2 space-y-2">
               {showAddProject ? (
                 <div className="space-y-2 animate-fade-in">
                   <input 
                     autoFocus
                     type="text"
                     value={newProjectPath}
                     onChange={(e) => setNewProjectPath(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                         registerProject();
                         setShowAddProject(false);
                       }
                       if (e.key === 'Escape') setShowAddProject(false);
                     }}
                     placeholder="Absolute path..."
                     className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-[10px] focus:outline-none focus:border-zinc-600"
                   />
                   <div className="flex gap-1">
                     <button 
                       onClick={() => { registerProject(); setShowAddProject(false); }}
                       className="flex-1 bg-zinc-100 text-black text-[9px] font-bold py-1 rounded"
                     >
                       ADD
                     </button>
                     <button 
                       onClick={() => setShowAddProject(false)}
                       className="px-2 bg-zinc-800 text-[9px] py-1 rounded"
                     >
                       ✕
                     </button>
                   </div>
                 </div>
               ) : (
                 <button 
                    onClick={() => setShowAddProject(true)}
                    className="w-full border border-zinc-800 border-dashed py-1 text-[9px] hover:bg-zinc-900 text-zinc-500 rounded"
                 >
                   + ADD LOCAL
                 </button>
               )}
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-4 flex-1 flex flex-col min-h-0 overflow-hidden">
            <FileExplorer 
              projectId={config.projectId}
              onFileClick={openFile}
            />
          </div>
        </div>
      </div>

      {/* MAIN — CHAT AREA */}
      <div className="flex-1 flex flex-col relative bg-zinc-950 min-w-0">
        
        {/* HEADER */}
        <div className="h-12 border-b border-zinc-900 flex items-center justify-between px-3 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLeft(v => !v)}
              title="Toggle workspace"
              className={`p-1.5 rounded transition-colors ${showLeft ? 'text-zinc-300 bg-zinc-800' : 'text-zinc-600 hover:text-zinc-300'}`}
            >
              <PanelIcon />
            </button>
            <span className="text-white font-bold text-xs tracking-widest italic">XENTARI</span>
            <span className="text-[10px] text-zinc-600">/</span>
            <span className="text-[11px] text-zinc-400 font-medium truncate max-w-[150px]">
              {config.projectDir?.split("/").pop() || "Select Project"}
            </span>
          </div>
          <div className="flex items-center gap-2">
             <div className="text-[10px] flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                <div className={`w-1.5 h-1.5 rounded-full ${availableModels.length > 0 ? 'bg-green-500 shadow-[0_0_5px_green]' : 'bg-red-500'}`} />
                <span className="text-zinc-400 hidden sm:inline">{config.model?.split(":")[0] || "No Model"}</span>
             </div>
             <button
               onClick={() => setShowContext(v => !v)}
               title="Toggle context panel"
               className={`p-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${ showContext ? 'text-zinc-300 bg-zinc-800' : 'text-zinc-600 hover:text-zinc-300'}`}
             >
               CTX
             </button>
             <button
               onClick={() => setShowStats(v => !v)}
               title="Toggle stats panel"
               className={`p-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${showStats ? 'text-zinc-300 bg-zinc-800' : 'text-zinc-600 hover:text-zinc-300'}`}
             >
               ⟁
             </button>
             <button onClick={() => setShowSettings(!showSettings)} className="hover:text-white p-1.5">
               <SettingsIcon />
             </button>
          </div>
        </div>

        {/* TIMELINE */}
        {timeline.length > 0 && <Timeline steps={timeline} />}

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
              <div className={`chat-bubble ${m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant opacity-0 animate-fade-in'}`} style={{ animationFillMode: 'forwards' }}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({node, inline, className, children, ...props}) {
                      const match = /language-(\w+)/.exec(className || '')
                      return !inline && match ? (
                        <SyntaxHighlighter
                          children={String(children).replace(/\n$/, '')}
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-lg my-2 text-[11px] border border-white/10"
                          {...props}
                        />
                      ) : (
                        <code className={`${className} bg-white/10 px-1 rounded text-[11px]`} {...props}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >
                  {m.content}
                </ReactMarkdown>
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
            {/* Command suggestions */}
            {prompt.startsWith("/") && activeCommand === "chat" && (
              <div className="absolute bottom-full mb-2 left-0 bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden shadow-xl z-10">
                {["/analyze", "/find", "/explain"]
                  .filter(c => c.includes(prompt.split(" ")[0]))
                  .map(cmd => (
                    <div
                      key={cmd}
                      onClick={() => { setPrompt(cmd + " "); setActiveCommand(cmd.slice(1)); }}
                      className="px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer flex items-center gap-2"
                    >
                      <span className="text-blue-400 font-mono font-bold">{cmd}</span>
                    </div>
                  ))}
              </div>
            )}
            {/* Active command badge */}
            {activeCommand !== "chat" && (
              <div className="absolute top-2 left-3 text-[10px] text-blue-400 font-mono font-bold bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-800/50 z-10">
                /{activeCommand}
              </div>
            )}
            <textarea 
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setActiveCommand(parseCommand(e.target.value).type);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  runAgent();
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
              onClick={() => runAgent()}
              disabled={running || !prompt.trim()}
              className={`absolute bottom-3 right-3 p-2 rounded-lg transition-all ${running || !prompt.trim() ? 'bg-zinc-800 text-zinc-600' : 'bg-white text-black hover:scale-105'}`}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>

      {/* CONTEXT PANEL — toggleable */}
      {showContext && <ContextPanel files={contextFiles} onFileClick={openFile} />}

      <FileDrawer
        file={selectedFile}
        content={fileContent}
        modifiedContent={modifiedContent}
        highlightLine={highlightLine}
        onClose={() => { setSelectedFile(null); setModifiedContent(""); }}
        onRunAgent={(options) => { setSelectedFile(null); runAgent(options); }}
        onApplyChanges={applyChanges}
      />

      {/* RIGHT — INFERENCE STATS — toggleable */}
      {showStats && <div className="w-64 flex-shrink-0 border-l border-zinc-900 bg-zinc-950/50 flex flex-col overflow-hidden">
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
                   { label: "Stack", value: state.header?.stack || "NODE" },
                   { label: "Phase", value: state.header?.phase || "IDLE" },
                   { label: "Mode", value: state.header?.mode || "SAFE" }
                 ].map(item => (
                   <div key={item.label} className="flex justify-between items-center text-[10px]">
                      <span className="text-zinc-500">{item.label}</span>
                      <span className="text-zinc-300 font-bold bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{item.value}</span>
                   </div>
                 ))}
              </div>
           </div>
         </div>
      </div>}

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
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
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
                    <option key={m.id} value={m.id}>
                      {m.name || m.id} {m.provider ? `(${m.provider})` : ''}
                    </option>
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

function PanelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>
    </svg>
  );
}