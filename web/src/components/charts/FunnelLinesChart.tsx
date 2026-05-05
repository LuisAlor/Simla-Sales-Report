import ReactECharts from "echarts-for-react";
import type { FunnelTsPoint } from "@/lib/transforms";
import { FUNNEL_COLORS } from "@/lib/mappings";

interface Props {
  data: FunnelTsPoint[];
  title?: string;
}

export function FunnelLinesChart({ data, title = "Etapas de la voronka" }: Props) {
  const stageKeys = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== "date") : [];

  const series = stageKeys.map((key, i) => ({
    name: key,
    type: "line",
    data: data.map((d) => d[key]),
    smooth: true,
    lineStyle: { color: FUNNEL_COLORS[i % FUNNEL_COLORS.length], width: 2 },
    itemStyle: { color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] },
    symbol: "none",
  }));

  const option = {
    backgroundColor: "#1E2238",
    tooltip: { trigger: "axis", backgroundColor: "#252A45", borderColor: "#2D3452", textStyle: { color: "#CBD5E1" } },
    legend: {
      data: stageKeys,
      bottom: 0,
      left: 0,
      orient: "horizontal" as const,
      textStyle: { color: "#CBD5E1", fontSize: 11 },
      icon: "circle",
      itemWidth: 8,
    },
    grid: { top: 48, bottom: 80, left: 16, right: 16, containLabel: true },
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

  return <ReactECharts option={option} style={{ height: 320 }} notMerge lazyUpdate />;
}
