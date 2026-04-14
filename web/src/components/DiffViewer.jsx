import { useMemo } from "react";

function computeDiff(oldStr, newStr) {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const max = Math.max(oldLines.length, newLines.length);
  const diff = [];

  // Simple line-by-line diff
  // In a real scenario, you'd use a library or a more complex LCS algorithm
  // but for "Xentari Zero Bloat", this is a start.
  
  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      diff.push({ type: "same", line: oldLines[i], oldIdx: i + 1, newIdx: j + 1 });
      i++;
      j++;
    } else {
      // Look ahead to see if we can find a match
      let foundMatch = false;
      for (let k = 1; k < 5; k++) {
        if (i + k < oldLines.length && oldLines[i + k] === newLines[j]) {
          // Lines i to i+k-1 were removed
          for (let m = 0; m < k; m++) {
            diff.push({ type: "removed", line: oldLines[i + m], oldIdx: i + m + 1 });
          }
          i += k;
          foundMatch = true;
          break;
        }
        if (j + k < newLines.length && oldLines[i] === newLines[j + k]) {
          // Lines j to j+k-1 were added
          for (let m = 0; m < k; m++) {
            diff.push({ type: "added", line: newLines[j + m], newIdx: j + m + 1 });
          }
          j += k;
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        if (i < oldLines.length) {
          diff.push({ type: "removed", line: oldLines[i], oldIdx: i + 1 });
          i++;
        }
        if (j < newLines.length) {
          diff.push({ type: "added", line: newLines[j], newIdx: j + 1 });
          j++;
        }
      }
    }
  }

  return diff;
}

export default function DiffViewer({ original, modified, onApply, onCancel }) {
  const diff = useMemo(() => computeDiff(original, modified), [original, modified]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 font-mono text-[11px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">Review Changes</span>
        <div className="flex gap-2">
          <button 
            onClick={onCancel}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onApply(modified)}
            className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white font-bold rounded text-[10px] transition-colors"
          >
            Apply Changes
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <tbody>
            {diff.map((d, i) => (
              <tr 
                key={i} 
                className={`${
                  d.type === "added" ? "bg-green-500/10 text-green-200" : 
                  d.type === "removed" ? "bg-red-500/10 text-red-300 line-through" : 
                  "text-zinc-400"
                }`}
              >
                <td className="w-8 text-right pr-2 select-none text-zinc-600 border-r border-zinc-800/50">
                  {d.oldIdx || ""}
                </td>
                <td className="w-8 text-right pr-2 select-none text-zinc-600 border-r border-zinc-800/50">
                  {d.newIdx || ""}
                </td>
                <td className="w-6 text-center select-none opacity-50">
                  {d.type === "added" ? "+" : d.type === "removed" ? "-" : " "}
                </td>
                <td className="pl-2 whitespace-pre leading-5">
                  {d.line || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
