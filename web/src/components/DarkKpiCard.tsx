interface Props {
  label: string;
  value: string;
  color?: string;
}

export function DarkKpiCard({ label, value, color = "#F59E0B" }: Props) {
  return (
    <div className="bg-navy-light border border-navy-border rounded-lg p-5 text-center min-w-[130px]">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      <p className="text-3xl font-extrabold leading-tight" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
