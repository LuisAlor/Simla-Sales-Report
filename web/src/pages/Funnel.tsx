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
import {
  FUNNEL_KEY_STAGES,
  FUNNEL_NEGATIVE_STAGES,
  FUNNEL_POSTSALES_STAGES,
} from "@/lib/mappings";
import { fmtInt, fmtUsd } from "@/lib/utils";
import type { OrderRecord } from "@/lib/flatten";

interface Props {
  records: OrderRecord[];
  freq: Freq;
}

const colStage = createColumnHelper<StageRow>();
const stageCols = [
  colStage.accessor("label", { header: "Etapa" }),
  colStage.accessor("count", { header: "Total", cell: (i) => fmtInt(i.getValue()) }),
  colStage.accessor("crPct", { header: "CR (%)", cell: (i) => `${i.getValue()}%` }),
];

interface FunnelSectionProps {
  title: string;
  rows: StageRow[];
  tsData: ReturnType<typeof funnelOverTime>;
  chartTitle: string;
}

function FunnelSection({ title, rows, tsData, chartTitle }: FunnelSectionProps) {
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
  const totalRegs = records.length;
  const returning = useMemo(
    () => records.filter((r) => r.cfReturning && r.cfReturning !== "no").length,
    [records]
  );
  const recommended = useMemo(
    () => records.filter((r) => r.cfIsReferral === "si").length,
    [records]
  );

  const fk = useMemo(() => financialKpis(records), [records]);
  const plat = useMemo(() => platformsBreakdown(records), [records]);

  const keyRows = useMemo(() => funnelStageCounts(records, FUNNEL_KEY_STAGES), [records]);
  const negRows = useMemo(() => funnelStageCounts(records, FUNNEL_NEGATIVE_STAGES), [records]);
  const psRows  = useMemo(() => funnelStageCounts(records, FUNNEL_POSTSALES_STAGES), [records]);

  const keyTs = useMemo(() => funnelOverTime(records, FUNNEL_KEY_STAGES, freq), [records, freq]);
  const negTs = useMemo(() => funnelOverTime(records, FUNNEL_NEGATIVE_STAGES, freq), [records, freq]);
  const psTs  = useMemo(() => funnelOverTime(records, FUNNEL_POSTSALES_STAGES, freq), [records, freq]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-0.5">Etapas del embudo</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Análisis del embudo de ventas · crm-license</p>

      <SectionHeader>Registros CRM</SectionHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
        <KpiCard label="Total registros"   value={fmtInt(totalRegs)} />
        <KpiCard label="Hecho de registro" value={fmtInt(totalRegs)} />
        <KpiCard label="♻️ Retornados"     value={fmtInt(returning)} />
        <KpiCard label="👍 Recomendados"   value={fmtInt(recommended)} />
      </div>

      <SectionHeader>Indicadores generales de ventas</SectionHeader>
      <div className="flex flex-wrap gap-3 mt-2">
        <DarkKpiCard label="Total Sales (#)" value={fmtInt(fk.totalSales)} color="#F59E0B" />
        <DarkKpiCard label="MRR"             value={fmtUsd(fk.mrr)}        color="#F59E0B" />
        <DarkKpiCard label="SARPU"           value={fmtUsd(fk.sarpu)}      color="#60A5FA" />
        <DarkKpiCard label="Total Refunded"  value={fmtUsd(fk.refunded)}   color="#F87171" />
        <DarkKpiCard label="Net Total"       value={fmtUsd(fk.netTotal)}   color="#86EFAC" />
      </div>

      <FunnelSection
        title="Etapas clave del embudo"
        rows={keyRows}
        tsData={keyTs}
        chartTitle="Etapas clave del embudo"
      />

      <FunnelSection
        title="Etapas negativas del embudo"
        rows={negRows}
        tsData={negTs}
        chartTitle="Etapas negativas del embudo"
      />

      <FunnelSection
        title="Etapas posventa del embudo"
        rows={psRows}
        tsData={psTs}
        chartTitle="Etapas posventa del embudo"
      />

      <SectionHeader>Fuentes de leads por plataforma</SectionHeader>
      {plat.length > 0 ? (
        <div className="bg-navy-light border border-navy-border rounded-lg p-3 mt-2">
          <PlatformsDonutChart data={plat} />
        </div>
      ) : (
        <p className="text-slate-500 text-sm mt-2">Sin datos de plataforma previa.</p>
      )}
    </div>
  );
}
