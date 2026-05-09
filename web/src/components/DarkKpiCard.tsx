interface Props {
  label: string;
  value: string;
  color?: string;
}

export function DarkKpiCard({ label, value, color = "#F59E0B" }: Props) {
  return (
    <div className="relative bg-navy-light border border-navy-border rounded-lg p-5 text-center overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-lg" style={{ background: "linear-gradient(90deg,#06b6d4,#3b82f6)" }} />
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      <p className="text-3xl font-extrabold leading-tight" style={{ color }}>{value}</p>
    </div>
  );
}
