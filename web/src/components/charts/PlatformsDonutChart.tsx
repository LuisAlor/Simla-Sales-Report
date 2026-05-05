import ReactECharts from "echarts-for-react";
import type { PlatformRow } from "@/lib/transforms";
import { PALETTE } from "@/lib/mappings";

interface Props {
  data: PlatformRow[];
}

export function PlatformsDonutChart({ data }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);

  const option = {
    backgroundColor: "#1E2238",
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)", backgroundColor: "#252A45", borderColor: "#2D3452", textStyle: { color: "#CBD5E1" } },
    legend: { orient: "vertical" as const, right: 0, top: "center", textStyle: { color: "#CBD5E1", fontSize: 11 } },
    color: PALETTE,
    graphic: [
      {
        type: "text",
        left: "center",
        top: "middle",
        style: {
          text: `${total.toLocaleString()}\nregistros`,
          textAlign: "center",
          fill: "#FFFFFF",
          fontSize: 16,
          fontWeight: "bold",
          lineHeight: 22,
        },
      },
    ],
    series: [
      {
        name: "Plataforma",
        type: "pie",
        radius: ["45%", "68%"],
        center: ["38%", "50%"],
        data: data.map((r) => ({ name: r.platform, value: r.count })),
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: "bold", color: "#FFFFFF" } },
      },
    ],
    title: { text: "Источники лидов по платформам", textStyle: { fontSize: 14, color: "#FFFFFF" }, top: 8, left: 12 },
  };

  return <ReactECharts option={option} style={{ height: 320 }} notMerge lazyUpdate />;
}
