import ReactECharts from "echarts-for-react";
import type { ManagerRow } from "@/lib/transforms";

interface Props {
  data: ManagerRow[];
}

export function ManagerBarChart({ data }: Props) {
  const option = {
    backgroundColor: "#fff",
    tooltip: { trigger: "axis" },
    grid: { top: 48, bottom: 56, left: 16, right: 16, containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((d) => d.managerName),
      axisLabel: { color: "#94A3B8", fontSize: 11, rotate: 30 },
      axisLine: { lineStyle: { color: "#E2E8F0" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#F1F5F9" } },
      axisLabel: { color: "#94A3B8", fontSize: 11 },
    },
    series: [
      {
        name: "Ingresos",
        type: "bar",
        data: data.map((d) => d.revenue),
        itemStyle: { color: "#00BCD4", borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: "top", formatter: (p: { dataIndex: number }) => `${data[p.dataIndex].orders} ped.`, fontSize: 10, color: "#64748B" },
      },
    ],
    title: { text: "Ingresos por asesor", textStyle: { fontSize: 14, color: "#1E293B" }, top: 8, left: 12 },
  };

  return <ReactECharts option={option} style={{ height: 280 }} notMerge lazyUpdate />;
}
