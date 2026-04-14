import { useState, useEffect } from "react";

function FileNode({ node, projectId, onFileClick }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadChildren = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/files?projectId=${projectId}&path=${encodeURIComponent(node.path)}`);
      const data = await res.json();
      setChildren(data);
    } catch (err) {
      console.error("Failed to load children", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async () => {
    if (node.type === "dir") {
      if (!open && children.length === 0) await loadChildren();
      setOpen(!open);
    } else {
      onFileClick(node.path);
    }
  };

  return (
    <div className="select-none">
      <div 
        onClick={handleClick} 
        className="flex items-center gap-1.5 py-1 px-2 hover:bg-zinc-800 rounded cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors group"
      >
        <span className="w-4 h-4 flex items-center justify-center">
          {node.type === "dir" ? (
            <span className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
              <ChevronIcon />
            </span>
          ) : (
            <FileIcon />
          )}
        </span>
        <span className="truncate">{node.name}</span>
        {loading && <span className="animate-spin text-[8px]">⌛</span>}
      </div>

      {open && (
        <div className="ml-3 border-l border-zinc-800 pl-1">
          {children.map(child => (
            <FileNode key={child.path} node={child} projectId={projectId} onFileClick={onFileClick} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorer({ projectId, onFileClick }) {
  const [rootFiles, setRootFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchRoot();
    }
  }, [projectId]);

  const fetchRoot = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/files?projectId=${projectId}&path=`);
      const data = await res.json();
      setRootFiles(data);
    } catch (err) {
      console.error("Failed to fetch root files", err);
    } finally {
      setLoading(false);
    }
  };

  if (!projectId) return <div className="p-4 text-[10px] text-zinc-600 italic">Select a project to explore files.</div>;

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      <div className="text-[9px] uppercase text-zinc-600 px-2 mb-2 tracking-tighter flex justify-between items-center">
        <span>Files</span>
        <button onClick={fetchRoot} className="hover:text-zinc-400">↻</button>
      </div>
      {loading && rootFiles.length === 0 ? (
        <div className="px-2 py-1 text-[10px] text-zinc-600 italic">Loading...</div>
      ) : (
        rootFiles.map(file => (
          <FileNode key={file.path} node={file} projectId={projectId} onFileClick={onFileClick} />
        ))
      )}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}
