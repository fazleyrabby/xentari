import { useEffect, useState } from "react";

export default function FileDrawer({ file, content, highlightLine, onClose, onSendToChat }) {
  const [activeLine, setActiveLine] = useState(null);

  if (!file) return null;

  const lines = content ? content.split("\n") : [];

  useEffect(() => {
    if (highlightLine !== null && highlightLine !== undefined) {
      document.getElementById(`line-${highlightLine}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [highlightLine, content]);

  // Reset active line when file changes
  useEffect(() => { setActiveLine(null); }, [file]);

  function getSnippet(i) {
    return lines.slice(Math.max(0, i - 5), i + 6).join("\n");
  }

  function sendAction(label, i) {
    const snippet = getSnippet(i);
    const msg = `${label}:\n\`\`\`\n${snippet}\n\`\`\`\n\n(from \`${file}\`, around line ${i + 1})`;
    setActiveLine(null);
    onSendToChat?.(msg);
  }

  return (
    <div className="fixed right-0 top-0 w-[500px] h-full bg-zinc-950 border-l border-zinc-800 flex flex-col z-40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[420px]">{file}</span>
        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-white transition-colors ml-2 flex-shrink-0"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {!content ? (
          <p className="p-4 text-[11px] text-zinc-600 italic">Loading...</p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => {
                const isHighlight = i === highlightLine;
                const isActive = i === activeLine;
                return (
                  <tr
                    key={i}
                    id={`line-${i}`}
                    className={`cursor-pointer ${isHighlight ? "bg-yellow-500/10" : isActive ? "bg-zinc-800" : "hover:bg-zinc-900"}`}
                    onClick={() => setActiveLine(isActive ? null : i)}
                  >
                    <td className="select-none text-right pr-3 pl-3 text-[10px] text-zinc-600 w-8 align-top pt-[1px]">
                      {i + 1}
                    </td>
                    <td className={`pr-2 text-[11px] font-mono whitespace-pre leading-5 ${isHighlight ? "text-yellow-200" : "text-zinc-300"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{line || " "}</span>
                        {isActive && (
                          <div className="flex gap-1 flex-shrink-0">
                            {["Explain", "Analyze", "Ask"].map(label => (
                              <button
                                key={label}
                                onClick={(e) => { e.stopPropagation(); sendAction(label + " this code", i); }}
                                className="text-[9px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2 py-0.5 rounded font-sans"
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
