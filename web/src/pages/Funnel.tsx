import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { KpiCard } from "@/components/KpiCard";
import { DarkKpiCard } from "@/components/DarkKpiCard";
import { SectionHeader } from "@/components/SectionHeader";
import { DataTable } from "@/components/DataTable";
import { FunnelLinesChart } from "@/components/charts/FunnelLinesChart";
import { PlatformsDonutChart } from "@/components/charts/PlatformsDonutChart";
import {
  financialKpis,
  platformsBreakdown,
  sectorBreakdown,
  funnelStageCounts,
  funnelOverTime,
  type StageRow,
  type Freq,
} from "@/lib/transforms";
import {
  FUNNEL_KEY_STAGES,
  FUNNEL_NEGATIVE_STAGES,
  FUNNEL_POSTSALES_STAGES,
  EXCLUDED_STATUS_CODES,
} from "@/lib/mappings";
import { fmtInt, fmtUsd } from "@/lib/utils";
import type { OrderRecord } from "@/lib/flatten";
import { useT } from "@/contexts/I18nContext";

interface Props {
  records: OrderRecord[];
  freq: Freq;
  statusLabels: Record<string, string>;
}

const RETURNING_VALUES = ["primer-retorno", "segundo-retorno", "tercer-retorno", "mas-de-cuatro-retornos"];

const colCr = createColumnHelper<StageRow>();

export function Funnel({ records, freq, statusLabels: _statusLabels }: Props) {
  const t = useT();

  const crCols = useMemo(() => [
    colCr.accessor("label", { header: t("funnel_table_stage") }),
    colCr.accessor("count", { header: t("funnel_table_total"), cell: (i) => fmtInt(i.getValue()) }),
    colCr.accessor("crPct", { header: t("funnel_table_cr"),    cell: (i) => `${i.getValue()}%` }),
  ], [t]);

  // ── KPI counts ───────────────────────────────────────────────────────────────
  const totalRegs  = records.length;
  const factRecords = useMemo(
    () => records.filter((r) => !EXCLUDED_STATUS_CODES.includes(r.status)),
    [records]
  );
  const factRegs   = factRecords.length;
  const returning  = useMemo(
    () => factRecords.filter((r) => r.cfReturning && RETURNING_VALUES.includes(r.cfReturning)).length,
    [factRecords]
  );
  const recommended = useMemo(
    () => factRecords.filter((r) => r.cfIsReferral === "si").length,
    [factRecords]
  );
  const desktopCount = useMemo(() => factRecords.filter((r) => r.cfDesktop).length, [factRecords]);
  const mobileCount  = useMemo(() => factRecords.filter((r) => r.cfMobile).length,  [factRecords]);

  // ── Financial KPIs ───────────────────────────────────────────────────────────
  const fk = useMemo(() => financialKpis(records), [records]);

  // ── Platform / Sector breakdown ──────────────────────────────────────────────
  const plat   = useMemo(() => platformsBreakdown(records), [records]);
  const sector = useMemo(() => sectorBreakdown(records),    [records]);

  // ── Stage counts for CR tables ───────────────────────────────────────────────
  const keyRows  = useMemo(() => funnelStageCounts(records, FUNNEL_KEY_STAGES, factRegs), [records, factRegs]);
  const postRows = useMemo(() => funnelStageCounts(records, FUNNEL_POSTSALES_STAGES, factRegs), [records, factRegs]);

  // ── Time-series data for line charts ─────────────────────────────────────────
  const keyTs  = useMemo(() => funnelOverTime(records, FUNNEL_KEY_STAGES,      freq), [records, freq]);
  const negTs  = useMemo(() => funnelOverTime(records, FUNNEL_NEGATIVE_STAGES, freq), [records, freq]);
  const postTs = useMemo(() => funnelOverTime(records, FUNNEL_POSTSALES_STAGES, freq), [records, freq]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-0.5">{t("funnel_title")}</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{t("funnel_subtitle")}</p>

      {/* ── CRM Records ────────────────────────────────────────────────────────── */}
      <SectionHeader>{t("funnel_crm_records")}</SectionHeader>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-2">
        <KpiCard label={t("funnel_total_records")}      value={fmtInt(totalRegs)} />
        <KpiCard label={t("funnel_registration_event")} value={fmtInt(factRegs)} />
        <KpiCard label={t("funnel_returned")}           value={fmtInt(returning)} />
        <KpiCard label={t("funnel_recommended")}        value={fmtInt(recommended)} />
        <KpiCard label={t("funnel_desktop")}            value={fmtInt(desktopCount)} />
        <KpiCard label={t("funnel_mobile")}             value={fmtInt(mobileCount)} />
      </div>

      {/* ── Key stages line chart + CR table ──────────────────────────────────── */}
      <SectionHeader>{t("funnel_key_stages")}</SectionHeader>
      <div className="bg-navy-light border border-navy-border rounded-xl overflow-hidden p-4 mt-2">
        <FunnelLinesChart data={keyTs} title={t("funnel_key_stages")} />
      </div>
      {keyRows.some((r) => r.count > 0) && (
        <div className="bg-navy-light border border-navy-border rounded-xl overflow-hidden mt-3">
          <DataTable data={keyRows} columns={crCols} dark />
        </div>
      )}

      {/* ── Negative stages line chart ─────────────────────────────────────────── */}
      <SectionHeader>{t("funnel_negative_stages")}</SectionHeader>
      <div className="bg-navy-light border border-navy-border rounded-xl overflow-hidden p-4 mt-2">
        <FunnelLinesChart data={negTs} title={t("funnel_negative_stages")} />
      </div>

      {/* ── Post-sales stages line chart + CR table ───────────────────────────── */}
      <SectionHeader>{t("funnel_postsale_stages")}</SectionHeader>
      <div className="bg-navy-light border border-navy-border rounded-xl overflow-hidden p-4 mt-2">
        <FunnelLinesChart data={postTs} title={t("funnel_postsale_stages")} />
      </div>
      {postRows.some((r) => r.count > 0) && (
        <div className="bg-navy-light border border-navy-border rounded-xl overflow-hidden mt-3">
          <DataTable data={postRows} columns={crCols} dark />
        </div>
      )}

      {/* ── Financial KPIs ─────────────────────────────────────────────────────── */}
      <SectionHeader>{t("funnel_sales_indicators")}</SectionHeader>
      <div className="flex flex-wrap gap-3 mt-2">
        <DarkKpiCard label={t("funnel_kpi_total_sales")} value={fmtInt(fk.totalSales)}  color="#F59E0B" />
        <DarkKpiCard label="MRR"                          value={fmtUsd(fk.mrr)}         color="#F59E0B" />
        <DarkKpiCard label="SARPU"                        value={fmtUsd(fk.sarpu)}       color="#60A5FA" />
        <DarkKpiCard label={t("funnel_kpi_refunded")}    value={fmtUsd(fk.refunded)}    color="#F87171" />
        <DarkKpiCard label={t("funnel_kpi_net_total")}   value={fmtUsd(fk.netTotal)}    color="#86EFAC" />
      </div>

      {/* ── Lead sources + Sector ───────────────────────────────────────────────── */}
      <SectionHeader>{t("funnel_lead_sources")}</SectionHeader>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
        {plat.length > 0 ? (
          <div className="bg-navy-light border border-navy-border rounded-xl overflow-hidden p-3">
            <PlatformsDonutChart data={plat} title={t("funnel_lead_sources")} centerLabel={t("funnel_center_platform")} />
          </div>
        ) : (
          <p className="text-slate-500 text-sm">{t("funnel_no_platform")}</p>
        )}
        {sector.length > 0 ? (
          <div className="bg-navy-light border border-navy-border rounded-xl overflow-hidden p-3">
            <PlatformsDonutChart data={sector} title={t("funnel_sector")} centerLabel={t("funnel_center_sector")} />
          </div>
        ) : (
          <p className="text-slate-500 text-sm">{t("funnel_no_sector")}</p>
        )}
      </div>
    </div>
  );
}
