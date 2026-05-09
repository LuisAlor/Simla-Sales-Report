import ReactECharts from "echarts-for-react";
import { useState } from "react";
import type { FunnelTsPoint } from "@/lib/transforms";
import { FUNNEL_COLORS } from "@/lib/mappings";

interface Props {
  data: FunnelTsPoint[];
  title?: string;
  yLabel?: string;
}

export function FunnelLinesChart({ data, title, yLabel = "N°" }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const stageKeys = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== "date") : [];

  const stageTotals = stageKeys.map((key, i) => ({
    key,
    total: data.reduce((s, d) => s + (Number(d[key]) || 0), 0),
    color: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
  }));
  const sum = stageTotals.reduce((s, st) => s + st.total, 0);

  function toggleSeries(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Preserve original colour index even when some series are filtered out
  const series = stageKeys
    .map((key, i) => ({ key, i }))
    .filter(({ key }) => !hidden.has(key))
    .map(({ key, i }) => ({
      name: key,
      type: "line",
      data: data.map((d) => d[key]),
      smooth: false,
      lineStyle: { color: FUNNEL_COLORS[i % FUNNEL_COLORS.length], width: 2 },
      itemStyle: { color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] },
      symbol: "circle",
      symbolSize: 5,
    }));

  const chartHeight = Math.max(260, stageKeys.length * 24 + 50);

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#252A45",
      borderColor: "#2D3452",
      textStyle: { color: "#CBD5E1", fontSize: 12 },
      formatter: (params: Array<{ seriesName: string; value: number; color: string; axisValueLabel: string }>) => {
        const date = params[0]?.axisValueLabel ?? "";
        const total = params.reduce((s, p) => s + (Number(p.value) || 0), 0);
        const rows = params
          .filter((p) => Number(p.value) > 0)
          .sort((a, b) => Number(b.value) - Number(a.value))
          .map((p) => `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${p.color}">— ${p.seriesName}</span><b>${p.value}</b></div>`)
          .join("");
        return `<div style="min-width:220px"><div style="font-weight:bold;margin-bottom:6px;color:#F1F5F9">${date}</div>${rows}<div style="border-top:1px solid #374151;margin-top:6px;padding-top:6px;display:flex;justify-content:space-between"><span style="color:#94A3B8">Total</span><b style="color:#F1F5F9">${total}</b></div></div>`;
      },
    },
    legend: { show: false },
    grid: { top: 24, bottom: 24, left: 40, right: 8, containLabel: false },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#94A3B8", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      name: yLabel,
      nameLocation: "end" as const,
      nameTextStyle: { color: "#94A3B8", fontSize: 10, align: "left", padding: [0, 0, 4, 4] },
      splitLine: { lineStyle: { color: "#2D3452" } },
      axisLabel: { color: "#94A3B8", fontSize: 11 },
    },
    series,
  };

  return (
    <div className="flex gap-3">
      {/* Chart */}
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold text-white mb-3">{title}</p>}
        <ReactECharts option={option} style={{ height: chartHeight }} notMerge lazyUpdate />
      </div>
      {/* Stage totals table — right, clickable to toggle series */}
      <div className="flex-shrink-0 w-52 flex flex-col self-start" style={{ marginTop: title ? 32 : 0 }}>
        {stageTotals.map((st) => {
          const isHidden = hidden.has(st.key);
          return (
            <div
              key={st.key}
              onClick={() => toggleSeries(st.key)}
              className="flex items-center gap-2 py-[5px] border-b border-white/5 last:border-0 cursor-pointer select-none transition-opacity hover:opacity-80"
              style={{ opacity: isHidden ? 0.3 : 1 }}
              title={isHidden ? "Click to show" : "Click to hide"}
            >
              <div
                className="w-5 h-[2px] flex-shrink-0 rounded transition-all"
                style={{ backgroundColor: isHidden ? "#4B5563" : st.color }}
              />
              <span className="flex-1 text-[10px] text-slate-300 truncate" title={st.key}>
                {isHidden ? <s className="opacity-60">{st.key}</s> : st.key}
              </span>
              <span className="text-[10px] font-semibold text-white">{st.total}</span>
            </div>
          );
        })}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/20">
          <span className="text-[10px] text-slate-400">Total</span>
          <span className="text-[11px] font-bold text-white bg-blue-700/40 px-2 py-0.5 rounded">{sum}</span>
        </div>
      </div>
    </div>
  );
}
