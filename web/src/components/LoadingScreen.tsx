interface Props {
  progress: { done: number; total: number } | null;
}

const BAR_HEIGHTS = [0.55, 0.80, 0.60, 0.90, 0.45, 0.70, 0.85, 0.55, 0.75, 0.40, 0.65, 0.50];

export function LoadingScreen({ progress }: Props) {
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const fillRatio = progress ? progress.done / progress.total : 0.12;
  const dashOffset = circumference * (1 - fillRatio);

  return (
    <div className="flex flex-col items-center justify-center h-[65vh] gap-6 select-none">

      {/* Animated bar chart */}
      <div className="flex items-end gap-1.5 h-20">
        {BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="w-4 rounded-t bg-slate-200 relative overflow-hidden"
            style={{ height: `${h * 100}%` }}
          >
            <div
              className="absolute bottom-0 left-0 right-0 bg-brand-blue"
              style={{
                height: `${fillRatio * 100}%`,
                transition: "height 0.5s ease",
                transitionDelay: `${i * 30}ms`,
                opacity: 0.7 + (i % 3) * 0.1,
              }}
            />
          </div>
        ))}
      </div>

      {/* Circular progress ring */}
      <div className="relative">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#E2E8F0" strokeWidth="7" />
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            stroke="url(#loadGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 48 48)"
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
          <defs>
            <linearGradient id="loadGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="100%" stopColor="#14B8A6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-slate-700 font-bold text-base">
            {progress ? `${pct}%` : "···"}
          </span>
        </div>
      </div>

      {/* Status text */}
      <div className="text-center">
        <p className="text-slate-600 text-sm font-medium">
          {progress
            ? `Cargando página ${progress.done} de ${progress.total}`
            : "Iniciando conexión con Simla…"}
        </p>
        {progress && (
          <p className="text-slate-400 text-xs mt-1">
            {progress.done} / {progress.total} páginas · {pct}% completado
          </p>
        )}
      </div>

      {/* Linear progress bar */}
      <div className="w-64 bg-slate-200 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress ? pct : 12}%`,
            background: "linear-gradient(to right, #0EA5E9, #14B8A6)",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
