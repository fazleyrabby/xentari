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
  onApplyChanges 
}) {
  const [view, setView] = useState("preview");

  useEffect(() => {
    if (modifiedContent) {
      setView("diff");
    } else {
      setView("preview");
    }
  }, [modifiedContent, file]);

  if (!file) return null;

  useEffect(() => {
    if (highlightLine !== null && highlightLine !== undefined) {
      document.getElementById(`line-${highlightLine}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [highlightLine, content]);

  return (
    <div className="fixed right-0 top-0 w-[600px] h-full bg-zinc-950 border-l border-zinc-800 flex flex-col z-40 animate-fade-in shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0 bg-zinc-900/30">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[300px]">{file}</span>
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
            />
          </div>
        )}
      </div>
    </div>
  );
}
