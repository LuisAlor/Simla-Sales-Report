import ReactECharts from "echarts-for-react";
import type { ManagerRow } from "@/lib/transforms";
import { useIsDark } from "@/contexts/ThemeContext";
import { chartTheme } from "@/lib/chartTheme";

interface Props {
  data: ManagerRow[];
}

export function ManagerBarChart({ data }: Props) {
  const isDark = useIsDark();
  const c = chartTheme(isDark);
  const option = {
    backgroundColor: c.bg,
    tooltip: { trigger: "axis", ...c.tooltip },
    grid: { top: 48, bottom: 40, left: 16, right: 16, containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((d) => d.managerName),
      axisLabel: { color: c.axisLabel, fontSize: 11, rotate: 0, interval: 0, overflow: "truncate", width: 90 },
      axisLine: { lineStyle: { color: c.axisLine } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: c.splitLine } },
      axisLabel: { color: c.axisLabel, fontSize: 11 },
    },
    series: [
      {
        name: "Ingresos",
        type: "bar",
        data: data.map((d) => d.revenue),
        itemStyle: { color: "#00BCD4", borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: "top", formatter: (p: { dataIndex: number }) => `${data[p.dataIndex].orders} ped.`, fontSize: 10, color: c.axisLabel },
      },
    ],
    title: { text: "Ingresos por asesor", textStyle: { fontSize: 14, color: c.title }, top: 8, left: 12 },
  };

  return <ReactECharts option={option} style={{ height: 280, background: c.bg }} notMerge lazyUpdate />;
}
