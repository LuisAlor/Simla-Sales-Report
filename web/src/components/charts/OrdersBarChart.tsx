import ReactECharts from "echarts-for-react";
import type { TsPoint } from "@/lib/transforms";
import { useIsDark } from "@/contexts/ThemeContext";
import { chartTheme } from "@/lib/chartTheme";

interface Props {
  data: TsPoint[];
}

export function OrdersBarChart({ data }: Props) {
  const c = chartTheme(useIsDark());
  const option = {
    backgroundColor: c.bg,
    tooltip: { trigger: "axis", ...c.tooltip },
    grid: { top: 48, bottom: 32, left: 60, right: 16 },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date),
      axisLine: { lineStyle: { color: c.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: c.axisLabel, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: c.splitLine } },
      axisLabel: { color: c.axisLabel, fontSize: 11 },
    },
    series: [
      {
        name: "Pedidos",
        type: "bar",
        data: data.map((d) => d.orders),
        itemStyle: { color: "#00BCD4", borderRadius: [3, 3, 0, 0] },
      },
    ],
    title: { text: "Pedidos en el tiempo", textStyle: { fontSize: 14, color: c.title }, top: 8, left: 12 },
  };

  return <ReactECharts option={option} style={{ height: 280 }} notMerge lazyUpdate />;
}
