import ReactECharts from "echarts-for-react";
import type { StatusRow } from "@/lib/transforms";
import { PALETTE } from "@/lib/mappings";

interface Props {
  data: StatusRow[];
  statusLabels?: Record<string, string>;
}

export function StatusPieChart({ data, statusLabels = {} }: Props) {
  const option = {
    backgroundColor: "#fff",
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 8,
      top: 40,
      bottom: 8,
      width: "52%",
      pageIconSize: 10,
      pageTextStyle: { color: "#94A3B8", fontSize: 10 },
      textStyle: { color: "#64748B", fontSize: 11 },
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
      textStyle: { fontSize: 14, color: "#1E293B" },
      top: 8,
      left: 12,
    },
  };

  return <ReactECharts option={option} style={{ height: 320 }} notMerge={true} lazyUpdate={true} />;
}
