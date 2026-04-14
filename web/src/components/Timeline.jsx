export default function Timeline({ steps }) {
  return (
    <div className="max-w-4xl mx-auto w-full px-4 pt-3 pb-1">
      <div className="text-[9px] uppercase text-zinc-600 tracking-widest mb-2">Execution trace</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {steps.map((s, i) => {
          const isLast = i === steps.length - 1;
          return (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLast ? "bg-emerald-400 shadow-[0_0_5px_#34d399]" : "bg-zinc-600"}`} />
              <span className={`text-[10px] ${isLast ? "text-zinc-200" : "text-zinc-500"}`}>
                {s.message}
              </span>
              {i < steps.length - 1 && (
                <span className="text-zinc-700 text-[10px]">→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
