import ReactECharts from "echarts-for-react";
import type { ProductRow } from "@/lib/transforms";
import { useIsDark } from "@/contexts/ThemeContext";
import { chartTheme } from "@/lib/chartTheme";

interface Props {
  data: ProductRow[];
}

export function TopProductsChart({ data }: Props) {
  const c = chartTheme(useIsDark());
  const sorted = [...data].sort((a, b) => a.revenue - b.revenue);
  const option = {
    backgroundColor: c.bg,
    tooltip: { trigger: "axis", ...c.tooltip },
    grid: { top: 48, bottom: 16, left: 16, right: 24, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: c.splitLine } },
      axisLabel: { color: c.axisLabel, fontSize: 11 },
    },
    yAxis: {
      type: "category",
      data: sorted.map((d) => d.productName),
      axisLabel: { color: c.axisLabel, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: "Ingresos",
        type: "bar",
        data: sorted.map((d) => d.revenue),
        itemStyle: { color: "#00BCD4", borderRadius: [0, 3, 3, 0] },
      },
    ],
    title: { text: "Productos principales por ingresos", textStyle: { fontSize: 14, color: c.title }, top: 8, left: 12 },
  };

  return <ReactECharts option={option} style={{ height: Math.max(280, sorted.length * 28 + 80), background: c.bg }} notMerge lazyUpdate />;
}
