interface Props {
  children: React.ReactNode;
}

export function SectionHeader({ children }: Props) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300 border-b-2 border-teal inline-block pb-1 mb-3 mt-5">
      {children}
    </h3>
  );
}
