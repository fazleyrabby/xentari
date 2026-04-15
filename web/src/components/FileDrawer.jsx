import { useEffect, useState } from "react";
import FilePreview from "./FilePreview";
import DiffViewer from "./DiffViewer";

export default function FileDrawer({ 
  file, 
  content, 
  modifiedContent, 
  highlightLine, 
  onClose, 
  onRunAgent,
  onApplyChanges,
  onAppendToChat 
}) {
  const [view, setView] = useState("preview");
  const [width, setWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (modifiedContent) {
      setView("diff");
    } else {
      setView("preview");
    }
  }, [modifiedContent, file]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 300 && newWidth < window.innerWidth * 0.8) {
        setWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (highlightLine !== null && highlightLine !== undefined) {
      document.getElementById(`line-${highlightLine}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [highlightLine, content]);

  if (!file) return null;

  return (
    <div 
      className="fixed right-0 top-0 h-full bg-zinc-950 border-l border-zinc-800 flex flex-col z-40 animate-fade-in shadow-2xl"
      style={{ width: `${width}px` }}
    >
      {/* RESIZE HANDLE */}
      <div 
        className="absolute left-0 top-0 w-1 h-full cursor-ew-resize hover:bg-emerald-500/50 transition-colors z-50"
        onMouseDown={() => setIsResizing(true)}
      />

      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0 bg-zinc-900/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[300px]">{file}</span>
            <button 
              onClick={() => navigator.clipboard.writeText(file)}
              className="text-zinc-600 hover:text-zinc-300 p-1"
              title="Copy relative path"
            >
              <CopyIcon />
            </button>
          </div>
          {modifiedContent && (
            <div className="flex bg-zinc-900 rounded p-0.5 border border-zinc-800">
              <button 
                onClick={() => setView("preview")}
                className={`px-2 py-0.5 text-[9px] rounded ${view === "preview" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Preview
              </button>
              <button 
                onClick={() => setView("diff")}
                className={`px-2 py-0.5 text-[9px] rounded ${view === "diff" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Diff
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-white transition-colors ml-2 flex-shrink-0"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {!content ? (
          <p className="p-4 text-[11px] text-zinc-600 italic">Loading...</p>
        ) : view === "diff" && modifiedContent ? (
          <DiffViewer 
            original={content} 
            modified={modifiedContent} 
            onApply={onApplyChanges}
            onCancel={() => setView("preview")}
          />
        ) : (
          <div className="h-full overflow-auto">
            <FilePreview 
              file={file}
              content={content}
              highlightLine={highlightLine}
              onRunAgent={onRunAgent}
              onAppendToChat={onAppendToChat}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  );
}
