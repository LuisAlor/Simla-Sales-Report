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
    legend: { orient: "vertical", right: 0, top: "center", textStyle: { color: "#64748B", fontSize: 11 } },
    color: PALETTE,
    series: [
      {
        name: "Estado",
        type: "pie",
        radius: ["40%", "68%"],
        center: ["38%", "50%"],
        data: data.map((r) => ({
          name: statusLabels[r.status] ?? r.status,
          value: r.orders,
        })),
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: "bold" } },
      },
    ],
    title: { text: "Pedidos por estado", textStyle: { fontSize: 14, color: "#1E293B" }, top: 8, left: 12 },
  };

  return <ReactECharts option={option} style={{ height: 280 }} notMerge={true} lazyUpdate={true} />;
}
