import ReactECharts from "echarts-for-react";
import type { ProductRow } from "@/lib/transforms";
import { useIsDark } from "@/contexts/ThemeContext";
import { useT } from "@/contexts/I18nContext";
import { chartTheme } from "@/lib/chartTheme";

interface Props { data: ProductRow[]; color?: string; }

export function TopProductsChart({ data, color = "#00BCD4" }: Props) {
  const c = chartTheme(useIsDark());
  const t = useT();
  const sorted = [...data].sort((a, b) => a.revenue - b.revenue);
  const option = {
    backgroundColor: c.bg,
    tooltip: {
      trigger: "axis",
      ...c.tooltip,
      formatter: (params: Array<{ dataIndex: number }>) => {
        const i = params[0].dataIndex;
        const d = sorted[i];
        return `<b>${d.productName}</b><br/>USD $${d.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>Cantidad: ${d.quantity}`;
      },
    },
    grid: { top: 48, bottom: 16, left: 16, right: 80, containLabel: true },
    xAxis: {
      type: "value",
      name: "USD",
      nameTextStyle: { color: c.axisLabel, fontSize: 10 },
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
    series: [{
      name: t("chart_series_revenue"),
      type: "bar",
      data: sorted.map((d) => d.revenue),
      itemStyle: { color, borderRadius: [0, 3, 3, 0] },
      label: {
        show: true,
        position: "right",
        color: c.axisLabel,
        fontSize: 11,
        formatter: (p: { dataIndex: number }) => `${sorted[p.dataIndex].quantity} u.`,
      },
    }],
    title: { text: t("chart_top_products"), textStyle: { fontSize: 14, color: c.title }, top: 8, left: 12 },
  };
  return <ReactECharts option={option} style={{ height: Math.max(280, sorted.length * 28 + 80) }} notMerge lazyUpdate />;
}
