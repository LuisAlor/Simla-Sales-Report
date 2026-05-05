interface Props {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
}

export function KpiCard({ label, value, delta, deltaPositive }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {delta && (
        <p className={`text-xs mt-1 font-medium ${deltaPositive !== false ? "text-emerald-600" : "text-red-500"}`}>
          {delta}
        </p>
      )}
    </div>
  );
}
