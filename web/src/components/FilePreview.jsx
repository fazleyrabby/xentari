import { useState, useEffect } from "react";

export default function FilePreview({ file, content, highlightLine, onRunAgent, onAppendToChat }) {
  const [selection, setSelection] = useState(null);
  const [activeLine, setActiveLine] = useState(null);
  const [menu, setMenu] = useState(null);

  // Reset active line when file changes
  useEffect(() => { setActiveLine(null); setMenu(null); }, [file]);

  if (typeof content !== "string") {
    return <div className="p-4 text-zinc-500 italic">File content is not available or invalid format.</div>;
  }

  const lines = content.split("\n");

  const handleMouseUp = (e) => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();

    if (!text || sel.rangeCount === 0) {
      if (!menu) setSelection(null);
      return;
    }

    // Optional: limit size
    if (text.length > 1000) return;

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

  const handleContextMenu = (e) => {
    e.preventDefault();
    const sel = window.getSelection();
    const text = sel?.toString().trim();

    setMenu({
      x: e.clientX,
      y: e.clientY,
      text: text || null
    });
  };

  const copyToChat = () => {
    if (!menu?.text) return;
    const msg = `User referenced file: ${file}\n\`\`\`\n${menu.text}\n\`\`\``;
    onAppendToChat?.(msg);
    setMenu(null);
    setSelection(null);
  };

  const copyPath = () => {
    navigator.clipboard.writeText(file);
    setMenu(null);
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
    return lines.slice(Math.max(0, i - 2), i + 3).join("\n");
  }

  function sendLineAction(label, i) {
    const snippet = getSnippet(i);
    const msg = `${label}:\n\`\`\`\n${snippet}\n\`\`\`\n\n(from \`${file}\`, line ${i + 1})`;
    setActiveLine(null);
    onRunAgent(msg);
  }

  return (
    <div className="relative" onMouseUp={handleMouseUp} onContextMenu={handleContextMenu} onClick={() => setMenu(null)}>
      {/* ACTION OVERLAY FOR ACTIVE LINE */}
      {activeLine !== null && (
        <div 
          className="fixed z-[60] bg-zinc-900 border border-emerald-500/30 rounded shadow-2xl px-2 py-1 flex gap-1 items-center animate-fade-in"
          style={{ 
            top: document.getElementById(`line-${activeLine}`)?.getBoundingClientRect().top,
            right: '20px' 
          }}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <span className="text-[9px] text-zinc-500 font-bold mr-2 uppercase tracking-tighter">Line {activeLine + 1}</span>
          {["Explain", "Analyze", "Ask"].map(label => (
            <button
              key={label}
              onClick={(e) => { e.stopPropagation(); sendLineAction(label, activeLine); }}
              className="text-[9px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded font-sans font-bold transition-colors"
            >
              {label}
            </button>
          ))}
          <button onClick={() => setActiveLine(null)} className="ml-1 text-zinc-500 hover:text-white">✕</button>
        </div>
      )}

      {menu && (
        <div 
          className="fixed z-[100] bg-zinc-900 border border-zinc-800 rounded shadow-2xl py-1 min-w-[120px] animate-fade-in"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.text && (
            <button 
              onClick={copyToChat}
              className="w-full text-left px-3 py-1.5 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Copy to chat
            </button>
          )}
          <button 
            onClick={copyPath}
            className="w-full text-left px-3 py-1.5 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            Copy relative path
          </button>
        </div>
      )}

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
                <td className={`pr-2 text-[11px] font-mono leading-5 break-all overflow-hidden ${isHighlight ? "text-yellow-200" : "text-zinc-300"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span>{line || " "}</span>
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
