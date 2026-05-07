import { useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
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

export function Analytics({ records, items, freq, statusLabels }: Props) {
  const t = useT();
  const [openSection, setOpenSection] = useState<string | null>(null);

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

  function toggle(s: string) {
    setOpenSection((prev) => (prev === s ? null : s));
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-0.5">{t("analytics_title")}</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{t("analytics_subtitle")}</p>

      <SectionHeader>{t("analytics_section_summary")}</SectionHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
        <KpiCard label={t("analytics_total_revenue")} value={fmtUsd(totalRevenue)} info={t("info_total_revenue")} />
        <KpiCard label={t("analytics_total_orders")}  value={fmtInt(totalOrders)}  info={t("info_total_orders")} />
        <KpiCard label={t("analytics_avg_ticket")}    value={fmtUsd(avgOrder)}     info={t("info_avg_ticket")} />
        <KpiCard label={t("analytics_gross_margin")}  value={fmtUsd(totalMargin)}  delta={`${marginPct.toFixed(1)}%`} info={t("info_gross_margin")} />
      </div>

      <SectionHeader>{t("analytics_section_temporal")}</SectionHeader>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
        <ChartCard info={t("info_revenue_time")}>
          <RevenueLineChart data={ts} />
        </ChartCard>
        <ChartCard info={t("info_orders_time")}>
          <OrdersBarChart data={ts} />
        </ChartCard>
      </div>

      <SectionHeader>{t("analytics_section_distribution")}</SectionHeader>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
        <ChartCard info={t("info_orders_status")}>
          <StatusPieChart data={statusData} statusLabels={statusLabels} />
        </ChartCard>
        <ChartCard info={t("info_revenue_manager")}>
          <ManagerBarChart data={managerData} />
        </ChartCard>
      </div>

      {productData.length > 0 && (
        <>
          <SectionHeader>{t("analytics_section_products")}</SectionHeader>
          <ChartCard info={t("info_top_products")} className="mt-2">
            <TopProductsChart data={productData} />
          </ChartCard>
        </>
      )}

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
    </div>
  );
}
