import ReactECharts from "echarts-for-react";
import type { StatusRow } from "@/lib/transforms";
import { PALETTE } from "@/lib/mappings";
import { useIsDark } from "@/contexts/ThemeContext";
import { chartTheme } from "@/lib/chartTheme";

interface Props {
  data: StatusRow[];
  statusLabels?: Record<string, string>;
}

export function StatusPieChart({ data, statusLabels = {} }: Props) {
  const c = chartTheme(useIsDark());
  const option = {
    backgroundColor: c.bg,
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)", ...c.tooltip },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 8,
      top: 40,
      bottom: 8,
      width: "52%",
      pageIconSize: 10,
      pageTextStyle: { color: c.axisLabel, fontSize: 10 },
      textStyle: { color: c.axisLabel, fontSize: 11 },
      itemGap: 6,
    },
    color: PALETTE,
    series: [
      {
        name: "Estado",
        type: "pie",
        radius: ["42%", "68%"],
        center: ["24%", "54%"],
        data: data.map((r) => ({
          name: statusLabels[r.status] ?? r.status,
          value: r.orders,
        })),
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold" } },
      },
    ],
    title: {
      text: "Pedidos por estado",
      textStyle: { fontSize: 14, color: c.title },
      top: 8,
      left: 12,
    },
  };

  return <ReactECharts option={option} style={{ height: 320 }} notMerge={true} lazyUpdate={true} />;
}
