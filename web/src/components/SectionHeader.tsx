interface Props {
  children: React.ReactNode;
}

export function SectionHeader({ children }: Props) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 shrink-0">
        {children}
      </span>
      <div className="flex-1 h-px bg-slate-100 dark:bg-gray-700/60" />
    </div>
  );
}
