import ReactECharts from "echarts-for-react";
import type { TsPoint } from "@/lib/transforms";
import { useIsDark } from "@/contexts/ThemeContext";
import { useT } from "@/contexts/I18nContext";
import { chartTheme } from "@/lib/chartTheme";

interface Props { data: TsPoint[]; color?: string; }

export function RevenueLineChart({ data, color = "#00BCD4" }: Props) {
  const c = chartTheme(useIsDark());
  const t = useT();
  const option = {
    backgroundColor: c.bg,
    tooltip: { trigger: "axis", axisPointer: { type: "cross" }, ...c.tooltip },
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
    series: [{
      name: t("chart_series_revenue"),
      type: "line",
      data: data.map((d) => d.revenue),
      smooth: true,
      lineStyle: { color, width: 2.5 },
      areaStyle: { color: color + "14" },
      itemStyle: { color },
      symbol: "none",
    }],
    title: { text: t("chart_revenue_time"), textStyle: { fontSize: 14, color: c.title }, top: 8, left: 12 },
  };
  return <ReactECharts option={option} style={{ height: 280 }} notMerge lazyUpdate />;
}
