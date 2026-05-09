import ReactECharts from "echarts-for-react";
import type { FunnelTsPoint } from "@/lib/transforms";
import { FUNNEL_COLORS } from "@/lib/mappings";

interface Props {
  data: FunnelTsPoint[];
  title?: string;
}

export function FunnelLinesChart({ data, title = "" }: Props) {
  const stageKeys = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== "date") : [];

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
          .map((p) => `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${p.color}">● ${p.seriesName}</span><b>${p.value}</b></div>`)
          .join("");
        return `<div style="min-width:220px"><div style="font-weight:bold;margin-bottom:6px;color:#F1F5F9">${date}</div>${rows}<div style="border-top:1px solid #374151;margin-top:6px;padding-top:6px;display:flex;justify-content:space-between"><span style="color:#94A3B8">Sum</span><b style="color:#F1F5F9">${total}</b></div></div>`;
      },
    },
    legend: {
      data: stageKeys,
      bottom: 0,
      left: 0,
      orient: "horizontal" as const,
      textStyle: { color: "#CBD5E1", fontSize: 11 },
      icon: "roundRect",
      itemWidth: 14,
      itemHeight: 4,
      type: "scroll" as const,
    },
    grid: { top: 36, bottom: 80, left: 16, right: 16, containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#94A3B8", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#2D3452" } },
      axisLabel: { color: "#94A3B8", fontSize: 11 },
    },
    series,
    title: { text: title, textStyle: { fontSize: 14, color: "#FFFFFF" }, top: 8, left: 12 },
  };

  return <ReactECharts option={option} style={{ height: Math.max(320, 80 + stageKeys.length * 18) }} notMerge lazyUpdate />;
}
