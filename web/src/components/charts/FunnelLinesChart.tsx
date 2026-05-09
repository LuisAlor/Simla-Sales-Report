import ReactECharts from "echarts-for-react";
import type { FunnelTsPoint } from "@/lib/transforms";
import { FUNNEL_COLORS } from "@/lib/mappings";

interface Props {
  data: FunnelTsPoint[];
  title?: string;
  yLabel?: string;
}

export function FunnelLinesChart({ data, title, yLabel = "N°" }: Props) {
  const stageKeys = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== "date") : [];

  const stageTotals = stageKeys.map((key, i) => ({
    key,
    total: data.reduce((s, d) => s + (Number(d[key]) || 0), 0),
    color: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
  }));
  const sum = stageTotals.reduce((s, st) => s + st.total, 0);

  const series = stageKeys.map((key, i) => ({
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
      {/* Stage totals table — right */}
      <div className="flex-shrink-0 w-52 flex flex-col self-start" style={{ marginTop: title ? 32 : 0 }}>
        {stageTotals.map((st) => (
          <div key={st.key} className="flex items-center gap-2 py-[5px] border-b border-white/5 last:border-0">
            <div className="w-5 h-[2px] flex-shrink-0 rounded" style={{ backgroundColor: st.color }} />
            <span className="flex-1 text-[10px] text-slate-300 truncate" title={st.key}>{st.key}</span>
            <span className="text-[10px] font-semibold text-white">{st.total}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/20">
          <span className="text-[10px] text-slate-400">Total</span>
          <span className="text-[11px] font-bold text-white bg-blue-700/40 px-2 py-0.5 rounded">{sum}</span>
        </div>
      </div>
    </div>
  );
}
