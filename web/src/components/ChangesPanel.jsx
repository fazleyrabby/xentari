export default function ChangesPanel({ changes, selectedFile, onSelectFile, onApplyAll, onRejectAll }) {
  if (!changes || changes.length === 0) return null;

  return (
    <div className="w-64 border-l border-zinc-800 bg-zinc-950 flex flex-col h-full animate-fade-in">
      <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/20">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Proposed Changes</span>
        <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20">{changes.length} files</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {changes.map((change) => (
          <div
            key={change.file}
            onClick={() => onSelectFile(change.file)}
            className={`p-2 rounded cursor-pointer transition-all border ${
              selectedFile === change.file 
                ? 'bg-zinc-900 border-zinc-700' 
                : 'border-transparent hover:bg-zinc-900/50 hover:border-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                change.action === 'create' ? 'bg-emerald-500' : 
                change.action === 'delete' ? 'bg-red-500' : 'bg-blue-500'
              }`} />
              <span className={`text-[11px] truncate flex-1 ${selectedFile === change.file ? 'text-white' : 'text-zinc-400'}`}>
                {change.file.split('/').pop()}
              </span>
            </div>
            <div className="text-[9px] text-zinc-600 mt-0.5 truncate pl-3.5 italic">
              {change.file}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-zinc-800 space-y-2 bg-zinc-900/10">
        <button
          onClick={onApplyAll}
          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded transition-all shadow-lg"
        >
          APPLY ALL
        </button>
        <button
          onClick={onRejectAll}
          className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-bold rounded transition-all"
        >
          REJECT ALL
        </button>
      </div>
    </div>
  );
}
