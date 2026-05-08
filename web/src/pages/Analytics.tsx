import { useMemo, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { createColumnHelper } from "@tanstack/react-table";
import { GripVertical, Eye, EyeOff, Settings2, X, ChevronDown, ChevronRight } from "lucide-react";
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
  revenueOverTime, ordersByStatus, ordersByManager, topProducts, repeatCustomers,
  type ManagerRow, type RepeatCustomer,
} from "@/lib/transforms";
import { fmtUsd, fmtInt } from "@/lib/utils";
import type { OrderRecord, ItemRecord } from "@/lib/flatten";
import type { Freq } from "@/lib/transforms";
import { useT } from "@/contexts/I18nContext";
import {
  loadFullLayout, saveFullLayout, countVisible, COLOR_PALETTE,
  CHART_SECTION,
  type FullLayout, type ChartId, type KpiId, type TableId, type SectionId,
} from "@/lib/chartLayout";

interface Props {
  records: OrderRecord[];
  items: ItemRecord[];
  freq: Freq;
  statusLabels: Record<string, string>;
}

const colMgr  = createColumnHelper<ManagerRow>();
const colCust = createColumnHelper<RepeatCustomer>();

function ChartCard({ info, children }: { info?: string; children: React.ReactNode }) {
  return (
    <div className="relative bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
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

const KPI_LABEL_KEYS: Record<KpiId, string> = {
  kpi_revenue:   "analytics_total_revenue",
  kpi_orders:    "analytics_total_orders",
  kpi_avg_ticket:"analytics_avg_ticket",
  kpi_margin:    "analytics_gross_margin",
};

const KPI_INFO_KEYS: Record<KpiId, string> = {
  kpi_revenue:    "info_total_revenue",
  kpi_orders:     "info_total_orders",
  kpi_avg_ticket: "info_avg_ticket",
  kpi_margin:     "info_gross_margin",
};

const TABLE_LABEL_KEYS: Record<TableId, string> = {
  table_repeat:  "analytics_repeat_customers",
  table_manager: "analytics_by_manager",
};

const SECTION_LABEL_KEYS: Record<SectionId, string> = {
  summary:      "analytics_section_summary",
  temporal:     "analytics_section_temporal",
  distribution: "analytics_section_distribution",
  products:     "analytics_section_products",
  detail:       "analytics_section_detail",
};

// ---------------------------------------------------------------------------
// Config panel
// ---------------------------------------------------------------------------

interface ConfigPanelProps {
  layout: FullLayout;
  onChange: (l: FullLayout) => void;
  onClose: () => void;
}

function ConfigPanel({ layout, onChange, onClose }: ConfigPanelProps) {
  const t = useT();
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    new Set(["summary", "temporal", "distribution", "products", "detail"])
  );
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const totalVis = countVisible(layout);
  const sectionVis = new Map(layout.sections.map((s) => [s.id, s.visible]));

  function effectiveCountForSection(id: SectionId): number {
    if (id === "summary") return layout.kpis.filter((k) => k.visible).length;
    if (id === "detail")  return layout.tables.filter((tb) => tb.visible).length;
    return layout.charts.filter((c) => CHART_SECTION[c.id] === id && c.visible).length;
  }

  function canHide(currentlyVisible: boolean, wouldRemoveCount = 1): boolean {
    return !currentlyVisible || totalVis - wouldRemoveCount >= 1;
  }

  function toggleSection(id: SectionId) {
    const sec = layout.sections.find((s) => s.id === id)!;
    if (sec.visible) {
      const removing = effectiveCountForSection(id);
      if (!canHide(true, removing)) return;
    }
    onChange({ ...layout, sections: layout.sections.map((s) => s.id === id ? { ...s, visible: !s.visible } : s) });
  }

  function toggleKpi(id: KpiId) {
    const kpi = layout.kpis.find((k) => k.id === id)!;
    if (!canHide(kpi.visible)) return;
    onChange({ ...layout, kpis: layout.kpis.map((k) => k.id === id ? { ...k, visible: !k.visible } : k) });
  }

  function toggleChart(id: ChartId) {
    const chart = layout.charts.find((c) => c.id === id)!;
    if (!canHide(chart.visible)) return;
    onChange({ ...layout, charts: layout.charts.map((c) => c.id === id ? { ...c, visible: !c.visible } : c) });
  }

  function setChartColor(id: ChartId, color: string) {
    onChange({ ...layout, charts: layout.charts.map((c) => c.id === id ? { ...c, color } : c) });
  }

  function toggleTable(id: TableId) {
    const tbl = layout.tables.find((tb) => tb.id === id)!;
    if (!canHide(tbl.visible)) return;
    onChange({ ...layout, tables: layout.tables.map((tb) => tb.id === id ? { ...tb, visible: !tb.visible } : tb) });
  }

  function handleDragStart(e: React.DragEvent, idx: number) {
    dragRef.current = idx;
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragRef.current !== null && dragRef.current !== idx) {
      const next = [...layout.charts];
      const [item] = next.splice(dragRef.current, 1);
      next.splice(idx, 0, item);
      onChange({ ...layout, charts: next });
    }
    dragRef.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  function toggleOpen(id: SectionId) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function EyeBtn({ visible, disabled, onToggle }: { visible: boolean; disabled?: boolean; onToggle: () => void }) {
    return (
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`p-1 rounded flex-shrink-0 transition-colors ${disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-100 dark:hover:bg-gray-600"}`}
        title={visible ? "Ocultar" : "Mostrar"}
      >
        {visible
          ? <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          : <EyeOff className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />}
      </button>
    );
  }

  function SectionRow({ id }: { id: SectionId }) {
    const sec = layout.sections.find((s) => s.id === id)!;
    const isOpen = openSections.has(id);
    const removeCount = effectiveCountForSection(id);
    const canToggle = canHide(sec.visible, removeCount);
    return (
      <div className="rounded-lg border border-slate-200 dark:border-gray-600 overflow-hidden">
        <div className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-50 dark:bg-gray-750">
          <button
            onClick={() => toggleOpen(id)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          >
            {isOpen
              ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
            <span className={`text-xs font-semibold truncate ${sec.visible ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500 line-through"}`}>
              {t(SECTION_LABEL_KEYS[id] as Parameters<typeof t>[0])}
            </span>
          </button>
          <EyeBtn visible={sec.visible} disabled={!canToggle} onToggle={() => toggleSection(id)} />
        </div>
        {isOpen && (
          <div className="divide-y divide-slate-100 dark:divide-gray-700">
            {id === "summary" && layout.kpis.map((kpi) => {
              const effVis = kpi.visible && sectionVis.get("summary");
              return (
                <div key={kpi.id} className={`flex items-center gap-2 px-3 py-2 ${!effVis ? "opacity-50" : ""}`}>
                  <span className="flex-1 text-xs text-slate-600 dark:text-slate-300 truncate">
                    {t(KPI_LABEL_KEYS[kpi.id] as Parameters<typeof t>[0])}
                  </span>
                  <EyeBtn
                    visible={kpi.visible}
                    disabled={!canHide(kpi.visible)}
                    onToggle={() => toggleKpi(kpi.id)}
                  />
                </div>
              );
            })}

            {(id === "temporal" || id === "distribution" || id === "products") &&
              layout.charts
                .map((chart, globalIdx) => ({ chart, globalIdx }))
                .filter(({ chart }) => CHART_SECTION[chart.id] === id)
                .map(({ chart, globalIdx }) => {
                  const effVis = chart.visible && sectionVis.get(id);
                  const isDragging = draggingIdx === globalIdx;
                  const isOver = dragOverIdx === globalIdx && draggingIdx !== globalIdx;
                  return (
                    <div
                      key={chart.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, globalIdx)}
                      onDragOver={(e) => handleDragOver(e, globalIdx)}
                      onDrop={(e) => handleDrop(e, globalIdx)}
                      onDragEnd={() => { dragRef.current = null; setDraggingIdx(null); setDragOverIdx(null); }}
                      className={[
                        "flex flex-col gap-1.5 px-3 py-2 cursor-grab active:cursor-grabbing select-none",
                        isDragging ? "opacity-30" : !effVis ? "opacity-50" : "",
                        isOver ? "bg-blue-50 dark:bg-blue-900/20" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0 pointer-events-none" />
                        <span className="flex-1 text-xs text-slate-600 dark:text-slate-300 truncate pointer-events-none">
                          {t(CHART_INFO_KEYS[chart.id].replace("info_", "chart_") as Parameters<typeof t>[0])}
                        </span>
                        <EyeBtn
                          visible={chart.visible}
                          disabled={!canHide(chart.visible)}
                          onToggle={() => toggleChart(chart.id)}
                        />
                      </div>
                      {/* Color swatches */}
                      <div className="flex items-center gap-1 pl-5.5 ml-5">
                        {COLOR_PALETTE.map((col) => (
                          <button
                            key={col}
                            onClick={() => setChartColor(chart.id, col)}
                            style={{ backgroundColor: col }}
                            className={`w-4 h-4 rounded-full flex-shrink-0 transition-transform hover:scale-125 ${chart.color === col ? "ring-2 ring-offset-1 ring-slate-500 dark:ring-slate-300 scale-110" : ""}`}
                            title={col}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
            }

            {id === "detail" && layout.tables.map((tbl) => {
              const effVis = tbl.visible && sectionVis.get("detail");
              return (
                <div key={tbl.id} className={`flex items-center gap-2 px-3 py-2 ${!effVis ? "opacity-50" : ""}`}>
                  <span className="flex-1 text-xs text-slate-600 dark:text-slate-300 truncate">
                    {t(TABLE_LABEL_KEYS[tbl.id] as Parameters<typeof t>[0])}
                  </span>
                  <EyeBtn
                    visible={tbl.visible}
                    disabled={!canHide(tbl.visible)}
                    onToggle={() => toggleTable(tbl.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-80 bg-white dark:bg-gray-800 shadow-2xl flex flex-col border-l border-slate-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("charts_configure_title")}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 px-4 py-2">{t("charts_configure_hint")}</p>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {(["summary", "temporal", "distribution", "products", "detail"] as SectionId[]).map((id) => (
            <SectionRow key={id} id={id} />
          ))}
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
  const [layout, setLayout] = useState<FullLayout>(() => loadFullLayout());

  const handleLayoutChange = useCallback((next: FullLayout) => {
    setLayout(next);
    saveFullLayout(next);
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
  const totalOrders  = records.length;
  const avgOrder     = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalMargin  = useMemo(() => records.reduce((s, r) => s + r.margin, 0), [records]);
  const marginPct    = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  const ts          = useMemo(() => revenueOverTime(records, freq), [records, freq]);
  const statusData  = useMemo(() => ordersByStatus(records), [records]);
  const managerData = useMemo(() => ordersByManager(records), [records]);
  const productData = useMemo(() => topProducts(items), [items]);
  const repeatData  = useMemo(() => repeatCustomers(records), [records]);

  const sectionVis = useMemo(
    () => new Map(layout.sections.map((s) => [s.id, s.visible])),
    [layout.sections]
  );

  // ── KPI rendering ──────────────────────────────────────────────────────────
  const kpiValues: Record<KpiId, { value: string; delta?: string }> = {
    kpi_revenue:    { value: fmtUsd(totalRevenue) },
    kpi_orders:     { value: fmtInt(totalOrders) },
    kpi_avg_ticket: { value: fmtUsd(avgOrder) },
    kpi_margin:     { value: fmtUsd(totalMargin), delta: `${marginPct.toFixed(1)}%` },
  };

  const visibleKpis = layout.kpis.filter((k) => k.visible && sectionVis.get("summary"));

  // ── Chart rendering ────────────────────────────────────────────────────────
  function renderChart(id: ChartId, color: string) {
    switch (id) {
      case "revenue_time":    return <RevenueLineChart data={ts}          color={color} />;
      case "orders_time":     return <OrdersBarChart   data={ts}          color={color} />;
      case "orders_status":   return <StatusPieChart   data={statusData}  statusLabels={statusLabels} />;
      case "revenue_manager": return <ManagerBarChart  data={managerData} color={color} />;
      case "top_products":    return productData.length > 0 ? <TopProductsChart data={productData} color={color} /> : null;
    }
  }

  function visibleChartsForSection(secId: SectionId) {
    return layout.charts.filter(
      (c) => CHART_SECTION[c.id] === secId && c.visible && sectionVis.get(secId)
    );
  }

  const visibleTables = layout.tables.filter((tb) => tb.visible && sectionVis.get("detail"));

  function toggle(s: string) {
    setOpenSection((prev) => (prev === s ? null : s));
  }

  // ── Render sections ────────────────────────────────────────────────────────
  const temporalCharts    = visibleChartsForSection("temporal");
  const distributionCharts = visibleChartsForSection("distribution");
  const productCharts     = visibleChartsForSection("products");

  return (
    <div>
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

      {/* Summary */}
      {visibleKpis.length > 0 && (
        <>
          <SectionHeader>{t("analytics_section_summary")}</SectionHeader>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
            {visibleKpis.map((kpi) => (
              <KpiCard
                key={kpi.id}
                label={t(KPI_LABEL_KEYS[kpi.id] as Parameters<typeof t>[0])}
                value={kpiValues[kpi.id].value}
                delta={kpiValues[kpi.id].delta}
                info={t(KPI_INFO_KEYS[kpi.id] as Parameters<typeof t>[0])}
              />
            ))}
          </div>
        </>
      )}

      {/* Temporal */}
      {temporalCharts.length > 0 && (
        <>
          <SectionHeader>{t("analytics_section_temporal")}</SectionHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
            {temporalCharts.map((c) => (
              <ChartCard key={c.id} info={t(CHART_INFO_KEYS[c.id] as Parameters<typeof t>[0])}>
                {renderChart(c.id, c.color)}
              </ChartCard>
            ))}
          </div>
        </>
      )}

      {/* Distribution */}
      {distributionCharts.length > 0 && (
        <>
          <SectionHeader>{t("analytics_section_distribution")}</SectionHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
            {distributionCharts.map((c) => (
              <ChartCard key={c.id} info={t(CHART_INFO_KEYS[c.id] as Parameters<typeof t>[0])}>
                {renderChart(c.id, c.color)}
              </ChartCard>
            ))}
          </div>
        </>
      )}

      {/* Products */}
      {productCharts.length > 0 && productData.length > 0 && (
        <>
          <SectionHeader>{t("analytics_section_products")}</SectionHeader>
          <div className="mt-2">
            {productCharts.map((c) => (
              <ChartCard key={c.id} info={t(CHART_INFO_KEYS[c.id] as Parameters<typeof t>[0])}>
                {renderChart(c.id, c.color)}
              </ChartCard>
            ))}
          </div>
        </>
      )}

      {/* Detail */}
      {visibleTables.length > 0 && (
        <>
          <SectionHeader>{t("analytics_section_detail")}</SectionHeader>
          <div className="flex flex-col gap-2 mt-2">
            {visibleTables.map(({ id }) => (
              <div key={id} className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
                <button
                  onClick={() => toggle(id)}
                  className="w-full flex justify-between items-center px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-gray-700 hover:bg-slate-100 dark:hover:bg-gray-600 transition-colors"
                >
                  {t(TABLE_LABEL_KEYS[id] as Parameters<typeof t>[0])}
                  <span className="text-slate-400 dark:text-slate-500">{openSection === id ? "▲" : "▼"}</span>
                </button>
                {openSection === id && (
                  <div className="p-3">
                    {id === "table_repeat"  && <DataTable data={repeatData}  columns={customerCols} />}
                    {id === "table_manager" && <DataTable data={managerData} columns={managerCols} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {showConfig && (
        <ConfigPanel layout={layout} onChange={handleLayoutChange} onClose={() => setShowConfig(false)} />
      )}
    </div>
  );
}
