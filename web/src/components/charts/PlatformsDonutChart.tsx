import ReactECharts from "echarts-for-react";
import type { PlatformRow } from "@/lib/transforms";

const EXTENDED_PALETTE = [
  "#00BCD4", "#2563EB", "#7C3AED", "#F59E0B", "#10B981",
  "#EF4444", "#6366F1", "#94A3B8", "#F97316", "#EC4899",
  "#84CC16", "#14B8A6", "#A855F7", "#EAB308", "#3B82F6",
  "#22C55E", "#DC2626", "#9333EA", "#0891B2", "#D97706",
];

interface Props {
  data: PlatformRow[];
  title?: string;
  centerLabel?: string;
}

export function PlatformsDonutChart({ data, title, centerLabel = "registros" }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);

  const option = {
    backgroundColor: "transparent",
    color: EXTENDED_PALETTE,
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
      backgroundColor: "#252A45",
      borderColor: "#2D3452",
      textStyle: { color: "#CBD5E1" },
    },
    legend: {
      type: "scroll" as const,
      orient: "vertical" as const,
      right: 6,
      top: "middle",
      itemGap: 6,
      textStyle: { color: "#CBD5E1", fontSize: 10 },
      pageIconSize: 10,
      pageTextStyle: { color: "#94A3B8" },
      itemWidth: 10,
      itemHeight: 6,
      formatter: (name: string) => {
        const item = data.find((d) => d.platform === name);
        return item ? `${name}  ${item.count}` : name;
      },
    },
    graphic: [
      {
        type: "text",
        left: "33%",
        top: "middle",
        bounding: "raw",
        z: 100,
        style: {
          text: `${total.toLocaleString()}\n${centerLabel}`,
          textAlign: "center",
          fill: "#FFFFFF",
          fontSize: 15,
          fontWeight: "bold",
          lineHeight: 22,
        },
      },
    ],
    series: [
      {
        name: title ?? "",
        type: "pie",
        radius: ["38%", "60%"],
        center: ["33%", "52%"],
        data: data.map((r) => ({ name: r.platform, value: r.count })),
        label: {
          show: true,
          formatter: "{d}%",
          color: "#FFFFFF",
          fontSize: 10,
          fontWeight: "bold",
          textBorderWidth: 0,
        },
        labelLine: {
          show: true,
          length: 8,
          length2: 6,
          lineStyle: { color: "#4B5563" },
        },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: "bold", color: "#FFFFFF" },
          scaleSize: 4,
        },
      },
    ],
    title: {
      text: title ?? "",
      textStyle: { fontSize: 13, color: "#FFFFFF" },
      top: 6,
      left: 12,
    },
  };

  return <ReactECharts option={option} style={{ height: 360 }} notMerge lazyUpdate />;
}
