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
    <div className="relative bg-white dark:bg-gray-800/80 border border-slate-200/80 dark:border-gray-700/60 rounded-xl p-4 shadow-sm overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl"
        style={{ background: "linear-gradient(90deg, #06b6d4, #3b82f6)" }}
      />
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex-1 truncate">
          {label}
        </p>
        {info && <InfoTooltip text={info} />}
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-none">{value}</p>
      {delta && (
        <p className={`text-xs mt-1.5 font-semibold ${deltaPositive !== false ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
          {delta}
        </p>
      )}
    </div>
  );
}
