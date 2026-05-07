import { InfoTooltip } from "@/components/InfoTooltip";

interface Props {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  info?: string;
}

export function KpiCard({ label, value, delta, deltaPositive, info }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex-1">{label}</p>
        {info && <InfoTooltip text={info} />}
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
      {delta && (
        <p className={`text-xs mt-1 font-medium ${deltaPositive !== false ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
          {delta}
        </p>
      )}
    </div>
  );
}
