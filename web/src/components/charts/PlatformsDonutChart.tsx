import ReactECharts from "echarts-for-react";
import { useState } from "react";
import type { PlatformRow } from "@/lib/transforms";

const EXTENDED_PALETTE = [
  "#00BCD4", "#2563EB", "#7C3AED", "#F59E0B", "#10B981",
  "#EF4444", "#6366F1", "#94A3B8", "#F97316", "#EC4899",
  "#84CC16", "#14B8A6", "#A855F7", "#EAB308", "#3B82F6",
  "#22C55E", "#DC2626", "#9333EA", "#0891B2", "#D97706",
];

interface Props {
  data: PlatformRow[];
  title?: string;
  centerLabel?: string;
}

export function PlatformsDonutChart({ data, title }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const total = data.reduce((s, d) => s + d.count, 0);

  function toggleSlice(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  const visibleData = data.filter((r) => !hidden.has(r.platform));

  const option = {
    backgroundColor: "transparent",
    color: EXTENDED_PALETTE,
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
      backgroundColor: "#252A45",
      borderColor: "#2D3452",
      textStyle: { color: "#CBD5E1" },
    },
    legend: { show: false },
    series: [
      {
        name: title ?? "",
        type: "pie",
        radius: ["42%", "68%"],
        center: ["50%", "50%"],
        // Keep original colour index per item so colours don't shift on hide
        data: visibleData.map((r) => ({
          name: r.platform,
          value: r.count,
          itemStyle: { color: EXTENDED_PALETTE[data.indexOf(r) % EXTENDED_PALETTE.length] },
        })),
        label: {
          show: true,
          formatter: "{d}%",
          color: "#FFFFFF",
          fontSize: 9,
          fontWeight: "bold",
          textBorderWidth: 0,
        },
        labelLine: {
          show: true,
          length: 6,
          length2: 4,
          lineStyle: { color: "#4B5563" },
        },
        emphasis: { scaleSize: 4 },
      },
    ],
  };

  return (
    <div>
      {title && <p className="text-sm font-semibold text-white mb-3 px-1">{title}</p>}
      <div className="flex gap-4 items-center">
        {/* Donut — left */}
        <div className="flex-1 min-w-0">
          <ReactECharts option={option} style={{ height: Math.max(220, data.length * 18 + 40) }} notMerge lazyUpdate />
        </div>
        {/* Legend table — right, clickable to toggle slices */}
        <div className="flex-shrink-0 w-48 flex flex-col">
          {data.map((item, i) => {
            const isHidden = hidden.has(item.platform);
            return (
              <div
                key={item.platform}
                onClick={() => toggleSlice(item.platform)}
                className="flex items-center gap-2 py-[4px] border-b border-white/5 last:border-0 cursor-pointer select-none hover:opacity-80 transition-opacity"
                style={{ opacity: isHidden ? 0.3 : 1 }}
                title={isHidden ? "Click to show" : "Click to hide"}
              >
                <div
                  className="w-5 h-[2px] flex-shrink-0 rounded transition-colors"
                  style={{ backgroundColor: isHidden ? "#4B5563" : EXTENDED_PALETTE[i % EXTENDED_PALETTE.length] }}
                />
                <span className="flex-1 text-[10px] text-slate-300 truncate" title={item.platform}>
                  {isHidden ? <s className="opacity-60">{item.platform}</s> : item.platform}
                </span>
                <span className="text-[10px] font-semibold text-white ml-1">{item.count}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/20">
            <span className="text-[10px] text-slate-400">Total</span>
            <span className="text-[11px] font-bold text-white bg-blue-700/40 px-2 py-0.5 rounded">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
