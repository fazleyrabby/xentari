import { useEffect } from "react";

export default function FileDrawer({ file, content, highlightLine, onClose }) {
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
                return (
                  <tr
                    key={i}
                    id={`line-${i}`}
                    className={isHighlight ? "bg-yellow-500/10" : "hover:bg-zinc-900"}
                  >
                    <td className="select-none text-right pr-3 pl-3 text-[10px] text-zinc-600 w-8 align-top pt-[1px]">
                      {i + 1}
                    </td>
                    <td className={`pr-4 text-[11px] font-mono whitespace-pre leading-5 ${isHighlight ? "text-yellow-200" : "text-zinc-300"}`}>
                      {line || " "}
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
