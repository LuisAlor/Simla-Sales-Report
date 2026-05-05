import ReactECharts from "echarts-for-react";
import type { TsPoint } from "@/lib/transforms";

interface Props {
  data: TsPoint[];
}

export function OrdersBarChart({ data }: Props) {
  const option = {
    backgroundColor: "#fff",
    tooltip: { trigger: "axis" },
    grid: { top: 48, bottom: 32, left: 60, right: 16 },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date),
      axisLine: { lineStyle: { color: "#E2E8F0" } },
      axisTick: { show: false },
      axisLabel: { color: "#94A3B8", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#F1F5F9" } },
      axisLabel: { color: "#94A3B8", fontSize: 11 },
    },
    series: [
      {
        name: "Pedidos",
        type: "bar",
        data: data.map((d) => d.orders),
        itemStyle: { color: "#00BCD4", borderRadius: [3, 3, 0, 0] },
      },
    ],
    title: { text: "Pedidos en el tiempo", textStyle: { fontSize: 14, color: "#1E293B" }, top: 8, left: 12 },
  };

  return <ReactECharts option={option} style={{ height: 280 }} notMerge lazyUpdate />;
}
