import ReactECharts from "echarts-for-react";
import type { StageRow } from "@/lib/transforms";

interface Props {
  data: StageRow[];
  title: string;
}

export function FunnelBarChart({ data, title }: Props) {
  const sorted = [...data].reverse();
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#252A45",
      borderColor: "#2D3452",
      textStyle: { color: "#CBD5E1" },
    },
    grid: { top: 48, bottom: 16, left: 16, right: 60, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#2D3452" } },
      axisLabel: { color: "#94A3B8", fontSize: 11 },
    },
    yAxis: {
      type: "category",
      data: sorted.map((d) => d.label),
      axisLabel: { color: "#CBD5E1", fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: "Total",
        type: "bar",
        data: sorted.map((d) => d.count),
        itemStyle: { color: "#00BCD4", borderRadius: [0, 3, 3, 0] },
        label: { show: true, position: "right", color: "#CBD5E1", fontSize: 11 },
      },
    ],
    title: { text: title, textStyle: { fontSize: 14, color: "#FFFFFF" }, top: 8, left: 12 },
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: Math.max(280, sorted.length * 32 + 80) }}
      notMerge
      lazyUpdate
    />
  );
}
