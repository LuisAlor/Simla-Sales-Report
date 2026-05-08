import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { KpiCard } from "@/components/KpiCard";
import { DarkKpiCard } from "@/components/DarkKpiCard";
import { SectionHeader } from "@/components/SectionHeader";
import { DataTable } from "@/components/DataTable";
import { FunnelBarChart } from "@/components/charts/FunnelBarChart";
import { PlatformsDonutChart } from "@/components/charts/PlatformsDonutChart";
import {
  financialKpis,
  platformsBreakdown,
  type StageRow,
  type Freq,
} from "@/lib/transforms";
import { fmtInt, fmtUsd } from "@/lib/utils";
import type { OrderRecord } from "@/lib/flatten";
import { useT } from "@/contexts/I18nContext";

interface Props {
  records: OrderRecord[];
  freq: Freq;
  statusLabels: Record<string, string>;
}

const colStage = createColumnHelper<StageRow>();

export function Funnel({ records, freq: _freq, statusLabels }: Props) {
  const t = useT();

  const stageCols = useMemo(() => [
    colStage.accessor("label",  { header: t("funnel_table_stage") }),
    colStage.accessor("count",  { header: t("funnel_table_total"), cell: (i) => fmtInt(i.getValue()) }),
    colStage.accessor("crPct",  { header: t("funnel_table_cr"),    cell: (i) => `${i.getValue()}%` }),
  ], [t]);

  const totalRegs = records.length;
  const returning = useMemo(
    () => records.filter((r) => r.cfReturning && r.cfReturning !== "no").length,
    [records]
  );
  const recommended = useMemo(
    () => records.filter((r) => r.cfIsReferral === "si").length,
    [records]
  );

  const fk   = useMemo(() => financialKpis(records),       [records]);
  const plat = useMemo(() => platformsBreakdown(records),  [records]);

  const dynamicRows = useMemo(() => {
    const base = records.length;
    return Object.entries(statusLabels)
      .map(([code, label]) => {
        const count = records.filter((r) => r.status === code).length;
        return { statusCode: code, label, count, crPct: base > 0 ? Math.round((count / base) * 1000) / 10 : 0 };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [records, statusLabels]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-0.5">{t("funnel_title")}</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{t("funnel_subtitle")}</p>

      <SectionHeader>{t("funnel_crm_records")}</SectionHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
        <KpiCard label={t("funnel_total_records")}      value={fmtInt(totalRegs)} />
        <KpiCard label={t("funnel_registration_event")} value={fmtInt(totalRegs)} />
        <KpiCard label={t("funnel_returned")}           value={fmtInt(returning)} />
        <KpiCard label={t("funnel_recommended")}        value={fmtInt(recommended)} />
      </div>

      <SectionHeader>{t("funnel_sales_indicators")}</SectionHeader>
      <div className="flex flex-wrap gap-3 mt-2">
        <DarkKpiCard label="Total Sales (#)" value={fmtInt(fk.totalSales)} color="#F59E0B" />
        <DarkKpiCard label="MRR"             value={fmtUsd(fk.mrr)}        color="#F59E0B" />
        <DarkKpiCard label="SARPU"           value={fmtUsd(fk.sarpu)}      color="#60A5FA" />
        <DarkKpiCard label="Total Refunded"  value={fmtUsd(fk.refunded)}   color="#F87171" />
        <DarkKpiCard label="Net Total"       value={fmtUsd(fk.netTotal)}   color="#86EFAC" />
      </div>

      {dynamicRows.length > 0 && (
        <>
          <SectionHeader>{t("funnel_key_stages")}</SectionHeader>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
            <div className="bg-navy-light border border-navy-border rounded-lg overflow-hidden p-3">
              <DataTable data={dynamicRows} columns={stageCols} dark />
            </div>
            <div className="col-span-2 bg-navy-light border border-navy-border rounded-lg overflow-hidden p-3">
              <FunnelBarChart data={dynamicRows} title={t("funnel_key_stages")} />
            </div>
          </div>
        </>
      )}

      <SectionHeader>{t("funnel_lead_sources")}</SectionHeader>
      {plat.length > 0 ? (
        <div className="bg-navy-light border border-navy-border rounded-lg overflow-hidden p-3 mt-2">
          <PlatformsDonutChart data={plat} title={t("funnel_lead_sources")} />
        </div>
      ) : (
        <p className="text-slate-500 text-sm mt-2">{t("funnel_no_platform")}</p>
      )}
    </div>
  );
}
