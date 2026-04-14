import { useState, useEffect } from "react";

export default function FilePreview({ file, content, highlightLine, onRunAgent }) {
  const [selection, setSelection] = useState(null);
  const [activeLine, setActiveLine] = useState(null);

  if (!content) return null;

  const lines = content.split("\n");

  // Reset active line when file changes
  useEffect(() => { setActiveLine(null); }, [file]);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();

    if (!text || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }

    // Optional: limit size
    if (text.length > 500) return;

    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelection({
        text,
        startLine: 0,
        endLine: 0,
        top: rect.top - 40,
        left: rect.left
      });
    } catch (e) {
      setSelection(null);
    }
  };

  const handleExplain = () => {
    onRunAgent({
      input: `/explain ${selection.text}`,
      meta: { command: 'explain', inline: true }
    });
    setSelection(null);
  };

  const handleRefactor = () => {
    onRunAgent({
      input: `Refactor the following code:\n\n${selection.text}`,
      meta: { command: 'chat', inline: true }
    });
    setSelection(null);
  };

  function getSnippet(i) {
    return lines.slice(Math.max(0, i - 5), i + 6).join("\n");
  }

  function sendLineAction(label, i) {
    const snippet = getSnippet(i);
    const msg = `${label}:\n\`\`\`\n${snippet}\n\`\`\`\n\n(from \`${file}\`, around line ${i + 1})`;
    setActiveLine(null);
    onRunAgent(msg);
  }

  return (
    <div className="relative" onMouseUp={handleMouseUp}>
      {selection && (
        <div 
          className="fixed z-50 bg-zinc-900 border border-zinc-800 rounded shadow-xl px-2 py-1 flex gap-2 items-center animate-fade-in"
          style={{ top: selection.top, left: selection.left }}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <button 
            onClick={handleExplain}
            className="text-[10px] font-bold text-zinc-300 hover:text-white px-2 py-0.5 rounded hover:bg-zinc-800 transition-colors"
          >
            Explain
          </button>
          <div className="w-[1px] h-3 bg-zinc-800" />
          <button 
            onClick={handleRefactor}
            className="text-[10px] font-bold text-zinc-300 hover:text-white px-2 py-0.5 rounded hover:bg-zinc-800 transition-colors"
          >
            Refactor
          </button>
          <button 
            onClick={() => setSelection(null)}
            className="ml-1 text-zinc-500 hover:text-white text-[10px]"
          >
            ✕
          </button>
        </div>
      )}

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
                      <div className="flex gap-1 flex-shrink-0" onMouseUp={(e) => e.stopPropagation()}>
                        {["Explain", "Analyze", "Ask"].map(label => (
                          <button
                            key={label}
                            onClick={(e) => { e.stopPropagation(); sendLineAction(label + " this code", i); }}
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
    </div>
  );
}
