import { useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { KpiCard } from "@/components/KpiCard";
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

interface Props {
  records: OrderRecord[];
  items: ItemRecord[];
  freq: Freq;
  statusLabels: Record<string, string>;
}

const colMgr = createColumnHelper<ManagerRow>();
const colCust = createColumnHelper<RepeatCustomer>();

const managerCols = [
  colMgr.accessor("managerName", { header: "Asesor" }),
  colMgr.accessor("orders", { header: "Pedidos", cell: (i) => fmtInt(i.getValue()) }),
  colMgr.accessor("revenue", { header: "Ingresos", cell: (i) => fmtUsd(i.getValue()) }),
  colMgr.accessor("avgOrder", { header: "Ticket prom.", cell: (i) => fmtUsd(i.getValue()) }),
];

const customerCols = [
  colCust.accessor("customerName", { header: "Cliente" }),
  colCust.accessor("orders", { header: "Pedidos", cell: (i) => fmtInt(i.getValue()) }),
  colCust.accessor("revenue", { header: "Ingresos", cell: (i) => fmtUsd(i.getValue()) }),
];

export function Analytics({ records, items, freq, statusLabels }: Props) {
  const [openSection, setOpenSection] = useState<string | null>(null);

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
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-0.5">Analíticas · Pedidos</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Estadísticas de todas las tiendas · Datos de pedidos recibidos</p>

      <SectionHeader>Resumen</SectionHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
        <KpiCard label="Ingresos totales" value={fmtUsd(totalRevenue)} />
        <KpiCard label="Total pedidos" value={fmtInt(totalOrders)} />
        <KpiCard label="Ticket promedio" value={fmtUsd(avgOrder)} />
        <KpiCard label="Margen bruto" value={fmtUsd(totalMargin)} delta={`${marginPct.toFixed(1)}%`} />
      </div>

      <SectionHeader>Evolución temporal</SectionHeader>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
          <RevenueLineChart data={ts} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
          <OrdersBarChart data={ts} />
        </div>
      </div>

      <SectionHeader>Distribución</SectionHeader>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
          <StatusPieChart data={statusData} statusLabels={statusLabels} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
          <ManagerBarChart data={managerData} />
        </div>
      </div>

      {productData.length > 0 && (
        <>
          <SectionHeader>Productos</SectionHeader>
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-3 shadow-sm mt-2">
            <TopProductsChart data={productData} />
          </div>
        </>
      )}

      <SectionHeader>Detalle</SectionHeader>
      <div className="flex flex-col gap-2 mt-2">
        {[
          { key: "repeat", label: "Clientes recurrentes" },
          { key: "manager", label: "Desglose por asesor" },
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
                {key === "repeat" && <DataTable data={repeatData} columns={customerCols} />}
                {key === "manager" && <DataTable data={managerData} columns={managerCols} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
