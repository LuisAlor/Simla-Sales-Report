import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { KpiCard } from "@/components/KpiCard";
import { DarkKpiCard } from "@/components/DarkKpiCard";
import { SectionHeader } from "@/components/SectionHeader";
import { DataTable } from "@/components/DataTable";
import { FunnelLinesChart } from "@/components/charts/FunnelLinesChart";
import { FunnelBarChart } from "@/components/charts/FunnelBarChart";
import { PlatformsDonutChart } from "@/components/charts/PlatformsDonutChart";
import {
  funnelStageCounts,
  funnelOverTime,
  financialKpis,
  platformsBreakdown,
  type StageRow,
  type Freq,
} from "@/lib/transforms";
import type { ColumnDef } from "@tanstack/react-table";
import {
  FUNNEL_KEY_STAGES,
  FUNNEL_NEGATIVE_STAGES,
  FUNNEL_POSTSALES_STAGES,
} from "@/lib/mappings";
import { fmtInt, fmtUsd } from "@/lib/utils";
import type { OrderRecord } from "@/lib/flatten";
import { useT } from "@/contexts/I18nContext";

interface Props {
  records: OrderRecord[];
  freq: Freq;
}

const colStage = createColumnHelper<StageRow>();

interface FunnelSectionProps {
  title: string;
  rows: StageRow[];
  tsData: ReturnType<typeof funnelOverTime>;
  chartTitle: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stageCols: ColumnDef<StageRow, any>[];
}

function FunnelSection({ title, rows, tsData, chartTitle, stageCols }: FunnelSectionProps) {
  return (
    <>
      <SectionHeader>{title}</SectionHeader>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
        <div className="bg-navy-light border border-navy-border rounded-lg p-3">
          <DataTable data={rows} columns={stageCols} dark />
        </div>
        <div className="col-span-2 bg-navy-light border border-navy-border rounded-lg p-3">
          {tsData.length > 0 && <FunnelLinesChart data={tsData} title={chartTitle} />}
        </div>
      </div>
      <div className="bg-navy-light border border-navy-border rounded-lg p-3 mt-3">
        <FunnelBarChart data={rows} title={chartTitle} />
      </div>
    </>
  );
}

export function Funnel({ records, freq }: Props) {
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

  const keyRows = useMemo(() => funnelStageCounts(records, FUNNEL_KEY_STAGES),      [records]);
  const negRows = useMemo(() => funnelStageCounts(records, FUNNEL_NEGATIVE_STAGES), [records]);
  const psRows  = useMemo(() => funnelStageCounts(records, FUNNEL_POSTSALES_STAGES),[records]);

  const keyTs = useMemo(() => funnelOverTime(records, FUNNEL_KEY_STAGES,      freq), [records, freq]);
  const negTs = useMemo(() => funnelOverTime(records, FUNNEL_NEGATIVE_STAGES, freq), [records, freq]);
  const psTs  = useMemo(() => funnelOverTime(records, FUNNEL_POSTSALES_STAGES, freq),[records, freq]);

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

      <FunnelSection title={t("funnel_key_stages")}      rows={keyRows} tsData={keyTs} chartTitle={t("funnel_key_stages")}      stageCols={stageCols} />
      <FunnelSection title={t("funnel_negative_stages")} rows={negRows} tsData={negTs} chartTitle={t("funnel_negative_stages")} stageCols={stageCols} />
      <FunnelSection title={t("funnel_postsale_stages")} rows={psRows}  tsData={psTs}  chartTitle={t("funnel_postsale_stages")} stageCols={stageCols} />

      <SectionHeader>{t("funnel_lead_sources")}</SectionHeader>
      {plat.length > 0 ? (
        <div className="bg-navy-light border border-navy-border rounded-lg p-3 mt-2">
          <PlatformsDonutChart data={plat} />
        </div>
      ) : (
        <p className="text-slate-500 text-sm mt-2">{t("funnel_no_platform")}</p>
      )}
    </div>
  );
}
