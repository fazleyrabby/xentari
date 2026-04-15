import { useState } from "react";

export default function DiffViewer({ file, diffData, onApply, onCancel }) {
  const [mode, setMode] = useState("inline"); // 'inline' or 'side-by-side'

  if (!diffData) return <div className="p-4 text-zinc-500 italic text-[11px]">Loading diff...</div>;

  const { lines, additions, deletions } = diffData;

  return (
    <div className="flex flex-col h-full bg-zinc-950 font-mono text-[11px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">Diff: {file}</span>
          <div className="flex gap-2 text-[9px]">
            <span className="text-emerald-500">+{additions}</span>
            <span className="text-red-500">-{deletions}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <select 
            value={mode} 
            onChange={(e) => setMode(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded text-[9px] px-1 text-zinc-300 outline-none"
          >
            <option value="inline">Inline</option>
            <option value="side-by-side">Side-by-Side</option>
          </select>
          <button 
            onClick={onCancel}
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[9px] transition-colors"
          >
            Reject
          </button>
          <button 
            onClick={onApply}
            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[9px] transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {mode === "inline" ? (
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => (
                <tr 
                  key={i} 
                  className={`${
                    line.type === "added" ? "bg-emerald-500/10 text-emerald-200" : 
                    line.type === "removed" ? "bg-red-500/10 text-red-300 line-through" : 
                    "text-zinc-400"
                  }`}
                >
                  <td className="w-8 text-right pr-2 select-none text-zinc-600 border-r border-zinc-800/50">
                    {line.oldLine || ""}
                  </td>
                  <td className="w-8 text-right pr-2 select-none text-zinc-600 border-r border-zinc-800/50">
                    {line.newLine || ""}
                  </td>
                  <td className="w-6 text-center select-none opacity-50">
                    {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                  </td>
                  <td className="pl-2 whitespace-pre-wrap break-all leading-5">
                    {line.content || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex h-full divide-x divide-zinc-800">
            {/* Side-by-side implementation (Simplified) */}
            <div className="flex-1 overflow-auto">
              <div className="p-2 text-[9px] text-zinc-600 uppercase bg-zinc-900/30 border-b border-zinc-800">Original</div>
              <table className="w-full">
                <tbody>
                  {lines.filter(l => l.type !== "added").map((line, i) => (
                    <tr key={i} className={line.type === "removed" ? "bg-red-500/10" : ""}>
                      <td className="w-8 text-right pr-2 text-zinc-600 border-r border-zinc-800/50">{line.oldLine}</td>
                      <td className="pl-2 whitespace-pre-wrap break-all text-zinc-400">{line.content || " "}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="p-2 text-[9px] text-zinc-600 uppercase bg-zinc-900/30 border-b border-zinc-800">Proposed</div>
              <table className="w-full">
                <tbody>
                  {lines.filter(l => l.type !== "removed").map((line, i) => (
                    <tr key={i} className={line.type === "added" ? "bg-emerald-500/10" : ""}>
                      <td className="w-8 text-right pr-2 text-zinc-600 border-r border-zinc-800/50">{line.newLine}</td>
                      <td className="pl-2 whitespace-pre-wrap break-all text-zinc-300">{line.content || " "}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
