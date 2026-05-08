import { useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { createColumnHelper } from "@tanstack/react-table";
import { GripVertical, Eye, EyeOff, Settings2, X } from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { InfoTooltip } from "@/components/InfoTooltip";
import { SectionHeader } from "@/components/SectionHeader";
import { DataTable } from "@/components/DataTable";
import { RevenueLineChart } from "@/components/charts/RevenueLineChart";
import { OrdersBarChart } from "@/components/charts/OrdersBarChart";
import { StatusPieChart } from "@/components/charts/StatusPieChart";
import { ManagerBarChart } from "@/components/charts/ManagerBarChart";
import { TopProductsChart } from "@/components/charts/TopProductsChart";
import {
  revenueOverTime,
  ordersByStatus,
  ordersByManager,
  topProducts,
  repeatCustomers,
  type ManagerRow,
  type RepeatCustomer,
} from "@/lib/transforms";
import { fmtUsd, fmtInt } from "@/lib/utils";
import type { OrderRecord, ItemRecord } from "@/lib/flatten";
import type { Freq } from "@/lib/transforms";
import { useT } from "@/contexts/I18nContext";
import {
  loadChartLayout,
  saveChartLayout,
  type ChartConfig,
  type ChartId,
} from "@/lib/chartLayout";

interface Props {
  records: OrderRecord[];
  items: ItemRecord[];
  freq: Freq;
  statusLabels: Record<string, string>;
}

const colMgr = createColumnHelper<ManagerRow>();
const colCust = createColumnHelper<RepeatCustomer>();

function ChartCard({ info, children, className }: { info?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-3 shadow-sm ${className ?? ""}`}>
      {info && <div className="absolute top-3 right-3 z-10"><InfoTooltip text={info} /></div>}
      {children}
    </div>
  );
}

const CHART_INFO_KEYS: Record<ChartId, string> = {
  revenue_time:    "info_revenue_time",
  orders_time:     "info_orders_time",
  orders_status:   "info_orders_status",
  revenue_manager: "info_revenue_manager",
  top_products:    "info_top_products",
};

const CHART_TITLE_KEYS: Record<ChartId, string> = {
  revenue_time:    "chart_revenue_time",
  orders_time:     "chart_orders_time",
  orders_status:   "chart_orders_status",
  revenue_manager: "chart_revenue_manager",
  top_products:    "chart_top_products",
};

// ---------------------------------------------------------------------------
// Configure panel (portal, slides in from right)
// ---------------------------------------------------------------------------

interface ConfigPanelProps {
  layout: ChartConfig[];
  onLayoutChange: (l: ChartConfig[]) => void;
  onClose: () => void;
}

function ConfigPanel({ layout, onLayoutChange, onClose }: ConfigPanelProps) {
  const t = useT();
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, idx: number) {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  }

  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (draggingIdx !== null && draggingIdx !== idx) {
      const next = [...layout];
      const [item] = next.splice(draggingIdx, 1);
      next.splice(idx, 0, item);
      onLayoutChange(next);
    }
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  function handleDragEnd() {
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  function toggle(id: ChartId) {
    onLayoutChange(layout.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex" onDragOver={(e) => e.preventDefault()}>
      {/* backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />
      {/* panel */}
      <div className="w-72 bg-white dark:bg-gray-800 shadow-2xl flex flex-col border-l border-slate-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t("charts_configure_title")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 px-4 py-2.5">
          {t("charts_configure_hint")}
        </p>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {layout.map((chart, idx) => {
            const isDragging = draggingIdx === idx;
            const isOver = dragOverIdx === idx && draggingIdx !== idx;
            return (
              <div
                key={chart.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg border select-none transition-colors",
                  "bg-white dark:bg-gray-700 cursor-grab active:cursor-grabbing",
                  isOver
                    ? "border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                    : "border-slate-200 dark:border-gray-600",
                  isDragging ? "opacity-40" : !chart.visible ? "opacity-50" : "opacity-100",
                ].join(" ")}
              >
                <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-500 flex-shrink-0 pointer-events-none" />
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate pointer-events-none">
                  {t(CHART_TITLE_KEYS[chart.id] as Parameters<typeof t>[0])}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggle(chart.id); }}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-gray-600 flex-shrink-0"
                >
                  {chart.visible
                    ? <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    : <EyeOff className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Main analytics page
// ---------------------------------------------------------------------------

export function Analytics({ records, items, freq, statusLabels }: Props) {
  const t = useT();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [layout, setLayout] = useState<ChartConfig[]>(() => loadChartLayout());

  const handleLayoutChange = useCallback((next: ChartConfig[]) => {
    setLayout(next);
    saveChartLayout(next);
  }, []);

  const managerCols = useMemo(() => [
    colMgr.accessor("managerName", { header: t("table_manager") }),
    colMgr.accessor("orders",      { header: t("table_orders"),     cell: (i) => fmtInt(i.getValue()) }),
    colMgr.accessor("revenue",     { header: t("table_revenue"),    cell: (i) => fmtUsd(i.getValue()) }),
    colMgr.accessor("avgOrder",    { header: t("table_avg_ticket"), cell: (i) => fmtUsd(i.getValue()) }),
  ], [t]);

  const customerCols = useMemo(() => [
    colCust.accessor("customerName", { header: t("table_customer") }),
    colCust.accessor("orders",       { header: t("table_orders"),  cell: (i) => fmtInt(i.getValue()) }),
    colCust.accessor("revenue",      { header: t("table_revenue"), cell: (i) => fmtUsd(i.getValue()) }),
  ], [t]);

  const totalRevenue = useMemo(() => records.reduce((s, r) => s + r.totalSumm, 0), [records]);
  const totalOrders = records.length;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalMargin = useMemo(() => records.reduce((s, r) => s + r.margin, 0), [records]);
  const marginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  const ts = useMemo(() => revenueOverTime(records, freq), [records, freq]);
  const statusData = useMemo(() => ordersByStatus(records), [records]);
  const managerData = useMemo(() => ordersByManager(records), [records]);
  const productData = useMemo(() => topProducts(items), [items]);
  const repeatData = useMemo(() => repeatCustomers(records), [records]);

  const chartComponents: Record<ChartId, React.ReactNode> = useMemo(() => ({
    revenue_time:    <RevenueLineChart data={ts} />,
    orders_time:     <OrdersBarChart data={ts} />,
    orders_status:   <StatusPieChart data={statusData} statusLabels={statusLabels} />,
    revenue_manager: <ManagerBarChart data={managerData} />,
    top_products:    productData.length > 0 ? <TopProductsChart data={productData} /> : null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ts, statusData, managerData, productData, statusLabels]);

  const visibleCharts = layout.filter(
    (c) => c.visible && chartComponents[c.id] !== null
  );

  function toggle(s: string) {
    setOpenSection((prev) => (prev === s ? null : s));
  }

  return (
    <div>
      {/* Page header with configure button */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-0.5">{t("analytics_title")}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t("analytics_subtitle")}</p>
        </div>
        <button
          onClick={() => setShowConfig(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 shadow-sm transition-colors mt-1 flex-shrink-0"
        >
          <Settings2 className="w-3.5 h-3.5" />
          {t("charts_configure")}
        </button>
      </div>

      {/* KPI summary */}
      <SectionHeader>{t("analytics_section_summary")}</SectionHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
        <KpiCard label={t("analytics_total_revenue")} value={fmtUsd(totalRevenue)} info={t("info_total_revenue")} />
        <KpiCard label={t("analytics_total_orders")}  value={fmtInt(totalOrders)}  info={t("info_total_orders")} />
        <KpiCard label={t("analytics_avg_ticket")}    value={fmtUsd(avgOrder)}     info={t("info_avg_ticket")} />
        <KpiCard label={t("analytics_gross_margin")}  value={fmtUsd(totalMargin)}  delta={`${marginPct.toFixed(1)}%`} info={t("info_gross_margin")} />
      </div>

      {/* Charts grid — ordered and filtered by layout state */}
      {visibleCharts.length > 0 && (
        <>
          <SectionHeader>{t("analytics_section_temporal")}</SectionHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
            {visibleCharts.map((chart) => (
              <ChartCard key={chart.id} info={t(CHART_INFO_KEYS[chart.id] as Parameters<typeof t>[0])}>
                {chartComponents[chart.id]}
              </ChartCard>
            ))}
          </div>
        </>
      )}

      {/* Detail tables */}
      <SectionHeader>{t("analytics_section_detail")}</SectionHeader>
      <div className="flex flex-col gap-2 mt-2">
        {[
          { key: "repeat",  label: t("analytics_repeat_customers") },
          { key: "manager", label: t("analytics_by_manager") },
        ].map(({ key, label }) => (
          <div key={key} className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={() => toggle(key)}
              className="w-full flex justify-between items-center px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-gray-700 hover:bg-slate-100 dark:hover:bg-gray-600 transition-colors"
            >
              {label}
              <span className="text-slate-400 dark:text-slate-500">{openSection === key ? "▲" : "▼"}</span>
            </button>
            {openSection === key && (
              <div className="p-3">
                {key === "repeat"  && <DataTable data={repeatData}  columns={customerCols} />}
                {key === "manager" && <DataTable data={managerData} columns={managerCols} />}
              </div>
            )}
          </div>
        ))}
      </div>

      {showConfig && (
        <ConfigPanel
          layout={layout}
          onLayoutChange={handleLayoutChange}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}
