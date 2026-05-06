import { useEffect, useState } from "react";

interface Props {
  progress: { done: number; total: number } | null;
}

const BARS = [0.42, 0.68, 0.55, 0.85, 0.38, 0.72, 0.60, 0.91, 0.48, 0.76, 0.33, 0.64];
const TOTAL_STEPS = BARS.length + 6; // bars + trend line frames + pause

// SVG trend line points (x,y) over a 280×80 viewport
const TREND: [number, number][] = [
  [8, 62], [31, 50], [54, 56], [77, 38], [100, 44],
  [123, 26], [146, 33], [169, 19], [192, 25], [215, 14],
  [238, 21], [272, 10],
];

function polylineLength(pts: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}
const LINE_LEN = polylineLength(TREND);
const POINTS_STR = TREND.map(([x, y]) => `${x},${y}`).join(" ");

export function LoadingScreen({ progress }: Props) {
  const [step, setStep] = useState(0);
  const [lineProgress, setLineProgress] = useState(0); // 0→1 for trend line draw

  // Advance the "analyst drawing" animation
  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % TOTAL_STEPS);
    }, 140);
    return () => clearInterval(id);
  }, []);

  // Animate trend line when all bars are done
  useEffect(() => {
    if (step === BARS.length) {
      setLineProgress(0);
      let frame = 0;
      const total = 18;
      const id = setInterval(() => {
        frame++;
        setLineProgress(frame / total);
        if (frame >= total) clearInterval(id);
      }, 40);
      return () => clearInterval(id);
    }
  }, [step]);

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const r = 32;
  const circumference = 2 * Math.PI * r;
  const fillRatio = progress ? progress.done / progress.total : 0;
  const dashOffset = circumference * (1 - fillRatio);
  const lineDash = LINE_LEN * (1 - lineProgress);

  const barsDrawn = Math.min(step, BARS.length);
  const showLine = step >= BARS.length;

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[70vh] gap-6 select-none">

      {/* Mock chart panel */}
      <div className="relative bg-white rounded-2xl shadow-md border border-slate-100 p-5 w-[340px]">
        {/* Panel header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" />
            <span className="text-xs font-semibold text-slate-500 tracking-wide">Ingresos por período</span>
          </div>
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            ))}
          </div>
        </div>

        {/* Y-axis ghost lines */}
        <div className="absolute left-5 right-5 top-[52px] bottom-10 pointer-events-none">
          {[0.25, 0.5, 0.75].map((t) => (
            <div
              key={t}
              className="absolute left-0 right-0 border-t border-dashed border-slate-100"
              style={{ bottom: `${t * 100}%` }}
            />
          ))}
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-1 h-28 relative z-10">
          {BARS.map((target, i) => {
            const drawn = i < barsDrawn;
            const drawing = i === barsDrawn && step < BARS.length;
            return (
              <div
                key={i}
                className="flex-1 rounded-sm relative overflow-hidden"
                style={{ height: `${target * 100}%`, backgroundColor: "#F1F5F9" }}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-sm"
                  style={{
                    height: drawn ? "100%" : drawing ? "60%" : "0%",
                    background: drawing
                      ? "linear-gradient(to top, #38BDF8, #7DD3FC)"
                      : drawn
                      ? i === barsDrawn - 1
                        ? "linear-gradient(to top, #0EA5E9, #38BDF8)"
                        : "linear-gradient(to top, #3B82F6cc, #0EA5E9cc)"
                      : "transparent",
                    transition: drawing
                      ? "height 0.12s ease-out"
                      : drawn
                      ? "background 0.3s ease"
                      : "height 0.05s ease",
                    opacity: drawn || drawing ? 1 : 0,
                  }}
                />
              </div>
            );
          })}

          {/* Trend line SVG overlay */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%"
            height="100%"
            viewBox="0 0 280 112"
            preserveAspectRatio="none"
          >
            {showLine && (
              <>
                {/* Glow shadow */}
                <polyline
                  points={POINTS_STR}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.2"
                  strokeDasharray={LINE_LEN}
                  strokeDashoffset={lineDash}
                />
                {/* Main line */}
                <polyline
                  points={POINTS_STR}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={LINE_LEN}
                  strokeDashoffset={lineDash}
                />
                {/* Moving dot at tip */}
                {lineProgress < 0.98 && (() => {
                  const idx = Math.min(
                    Math.floor(lineProgress * (TREND.length - 1)),
                    TREND.length - 2
                  );
                  const t = lineProgress * (TREND.length - 1) - idx;
                  const x = TREND[idx][0] + t * (TREND[idx + 1][0] - TREND[idx][0]);
                  const y = TREND[idx][1] + t * (TREND[idx + 1][1] - TREND[idx][1]);
                  return (
                    <circle cx={x} cy={y} r="3.5" fill="#F59E0B" />
                  );
                })()}
              </>
            )}
          </svg>
        </div>

        {/* X-axis labels ghost */}
        <div className="flex justify-between mt-2 px-0.5">
          {["Ene", "Feb", "Mar", "Abr", "May", "Jun"].map((m, i) => (
            <span
              key={m}
              className="text-[9px] text-slate-300 transition-colors duration-300"
              style={{ color: i * 2 < barsDrawn ? "#94A3B8" : "#E2E8F0" }}
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Progress ring + label */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <svg width="72" height="72" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={r} fill="none" stroke="#E2E8F0" strokeWidth="6" />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke="url(#loadGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 40 40)"
              style={{ transition: "stroke-dashoffset 0.35s ease" }}
            />
            <defs>
              <linearGradient id="loadGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0EA5E9" />
                <stop offset="100%" stopColor="#14B8A6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-slate-700 font-bold text-sm">
              {progress ? `${pct}%` : "···"}
            </span>
          </div>
        </div>

        <div>
          <p className="text-slate-600 text-sm font-medium">
            {progress ? `Página ${progress.done} de ${progress.total}` : "Conectando con Simla…"}
          </p>
          {progress && (
            <p className="text-slate-400 text-xs mt-0.5">{pct}% completado</p>
          )}
        </div>
      </div>
    </div>
  );
}
