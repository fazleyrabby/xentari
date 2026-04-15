import { useState } from "react";

function ScoringTimeline({ steps }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 border-l border-zinc-800 ml-1 pl-3 py-1">
      {steps.map((step, i) => (
        <div key={i} className="flex justify-between items-center text-[9px]">
          <span className="text-zinc-500">{step.label}</span>
          <span className={`font-mono font-bold ${step.value > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {step.value > 0 ? `+${step.value}` : step.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ContextPanel({ files, onFileClick }) {
  const [expandedFile, setExpandedFile] = useState(null);

  if (!files || files.length === 0) return null;

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-950 p-3 overflow-y-auto scrollbar-hide">
      <h2 className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-widest flex justify-between items-center">
        <span>Context Used</span>
        <span className="text-[9px] bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-600 border border-zinc-800">{files.length}</span>
      </h2>

      <div className="space-y-2">
        {files.map((file, idx) => (
          <div 
            key={file.path} 
            className={`group p-2 rounded border transition-all cursor-pointer ${
              expandedFile === file.path ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800'
            }`}
            onClick={() => setExpandedFile(expandedFile === file.path ? null : file.path)}
          >
            <div className="flex justify-between items-start gap-2">
              <div 
                className="text-[10px] text-zinc-300 font-mono truncate flex-1 hover:text-white"
                onClick={(e) => { e.stopPropagation(); onFileClick(file.path); }}
              >
                {file.path}
              </div>
              <div className="text-[10px] font-bold text-emerald-500 tabular-nums bg-emerald-500/5 px-1 rounded">
                {file.score}
              </div>
            </div>

            {expandedFile === file.path && (
              <div className="animate-fade-in">
                <ScoringTimeline steps={file.steps} />
                <div className="mt-2 pt-2 border-t border-zinc-800/50 flex justify-end">
                   <button 
                     onClick={(e) => { e.stopPropagation(); onFileClick(file.path); }}
                     className="text-[9px] text-zinc-500 hover:text-white uppercase font-bold"
                   >
                     View Content
                   </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
