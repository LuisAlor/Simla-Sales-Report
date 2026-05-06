import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

interface Option { value: string; label: string; }

interface Props {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  variant?: "dark" | "light";
}

export function MultiSelect({ options, selected, onChange, placeholder = "Buscar…", emptyLabel = "Sin opciones", variant = "dark" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedOptions = options.filter((o) => selected.includes(o.value));
  const filtered = options.filter(
    (o) => !selected.includes(o.value) && o.label.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const isDark = variant === "dark";

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex flex-wrap gap-1 items-center rounded-md px-2 py-1 min-h-[30px] cursor-text border ${
          isDark
            ? "bg-navy-border border-navy-border"
            : "bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600"
        }`}
        onClick={() => setOpen(true)}
      >
        {selectedOptions.map((o) => (
          <span key={o.value} className="flex items-center gap-0.5 bg-brand-blue text-white text-[10px] px-1.5 py-0.5 rounded">
            {o.label}
            <button
              onClick={(e) => { e.stopPropagation(); toggle(o.value); }}
              className="hover:opacity-70"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <input
          className={`flex-1 min-w-[50px] text-xs bg-transparent outline-none ${
            isDark ? "text-white placeholder-slate-500" : "text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
          }`}
          placeholder={selected.length === 0 ? placeholder : ""}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && (
        <div className={`absolute top-full left-0 right-0 mt-1 border rounded-md max-h-48 overflow-y-auto z-50 shadow-lg ${
          isDark ? "bg-[#1a2233] border-navy-border" : "bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700"
        }`}>
          {filtered.length === 0 ? (
            <p className={`text-xs px-2 py-1.5 italic ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              {search ? "Sin resultados" : emptyLabel}
            </p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                onClick={() => { toggle(o.value); setSearch(""); }}
                className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                  isDark
                    ? "text-slate-300 hover:bg-navy-border"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700"
                }`}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
