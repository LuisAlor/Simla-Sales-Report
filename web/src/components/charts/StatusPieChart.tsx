import ReactECharts from "echarts-for-react";
import { useState } from "react";
import type { StatusRow } from "@/lib/transforms";
import { PALETTE } from "@/lib/mappings";
import { useT } from "@/contexts/I18nContext";

interface Props {
  data: StatusRow[];
  statusLabels?: Record<string, string>;
}

export function StatusPieChart({ data, statusLabels = {} }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const t = useT();

  const total = data.reduce((s, r) => s + r.orders, 0);

  function toggleSlice(status: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  }

  const visibleData = data.filter((r) => !hidden.has(r.status));

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
      backgroundColor: "#252A45",
      borderColor: "#2D3452",
      textStyle: { color: "#CBD5E1" },
    },
    legend: { show: false },
    color: PALETTE,
    series: [{
      name: t("chart_series_status"),
      type: "pie",
      radius: ["42%", "68%"],
      center: ["50%", "50%"],
      // Preserve original colour index per slice
      data: visibleData.map((r) => ({
        name: statusLabels[r.status] ?? r.status,
        value: r.orders,
        itemStyle: { color: PALETTE[data.indexOf(r) % PALETTE.length] },
      })),
      label: {
        show: true,
        formatter: "{d}%",
        color: "#FFFFFF",
        fontSize: 9,
        fontWeight: "bold",
        textBorderWidth: 0,
      },
      labelLine: {
        show: true,
        length: 6,
        length2: 4,
        lineStyle: { color: "#4B5563" },
      },
      emphasis: { scaleSize: 4 },
    }],
  };

  return (
    <div>
      <p className="text-sm font-semibold text-white mb-3 px-1">{t("chart_orders_status")}</p>
      <div className="flex gap-4 items-center">
        {/* Donut */}
        <div className="flex-1 min-w-0">
          <ReactECharts
            option={option}
            style={{ height: Math.max(220, data.length * 18 + 40) }}
            notMerge
            lazyUpdate
          />
        </div>
        {/* Clickable legend table */}
        <div className="flex-shrink-0 w-52 flex flex-col">
          {data.map((r, i) => {
            const label = statusLabels[r.status] ?? r.status;
            const isHidden = hidden.has(r.status);
            return (
              <div
                key={r.status}
                onClick={() => toggleSlice(r.status)}
                className="flex items-center gap-2 py-[4px] border-b border-white/5 last:border-0 cursor-pointer select-none hover:opacity-80 transition-opacity"
                style={{ opacity: isHidden ? 0.3 : 1 }}
                title={isHidden ? "Click to show" : "Click to hide"}
              >
                <div
                  className="w-5 h-[2px] flex-shrink-0 rounded transition-colors"
                  style={{ backgroundColor: isHidden ? "#4B5563" : PALETTE[i % PALETTE.length] }}
                />
                <span className="flex-1 text-[10px] text-slate-300 truncate" title={label}>
                  {isHidden ? <s className="opacity-60">{label}</s> : label}
                </span>
                <span className="text-[10px] font-semibold text-white ml-1">{r.orders}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/20">
            <span className="text-[10px] text-slate-400">Total</span>
            <span className="text-[11px] font-bold text-white bg-blue-700/40 px-2 py-0.5 rounded">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
