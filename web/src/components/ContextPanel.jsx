export default function ContextPanel({ files, onFileClick }) {
  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-950 p-3 overflow-y-auto">
      <h2 className="text-xs font-bold text-zinc-400 mb-3 uppercase">
        Context Used
      </h2>

      {files.length === 0 && (
        <div className="text-xs text-zinc-600">
          No context yet
        </div>
      )}

      {files.map((file, i) => (
        <div
          key={i}
          className="mb-2 p-2 rounded bg-zinc-900 hover:bg-zinc-800 cursor-pointer transition"
          onClick={() => onFileClick?.(file.path)}
        >
          <div className="text-xs text-zinc-200 truncate">
            {file.path}
          </div>

          <div className="text-[10px] text-zinc-500">
            score: {file.score}
          </div>
        </div>
      ))}
    </div>
  );
}
