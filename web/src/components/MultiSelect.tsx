import { useState, useRef, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";

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
  const inputRef = useRef<HTMLInputElement>(null);

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

  function openAndFocus() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const isDark = variant === "dark";

  const triggerCls = `flex items-center gap-1 rounded-md px-2 h-[30px] cursor-pointer border ${
    isDark
      ? "bg-gray-800/60 border-gray-700/60"
      : "bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600"
  }`;

  const summaryText = () => {
    if (selectedOptions.length === 0) return null;
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    return `${selectedOptions[0].label.length > 10 ? selectedOptions[0].label.slice(0, 9) + "…" : selectedOptions[0].label} +${selectedOptions.length - 1}`;
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div className={triggerCls} onClick={openAndFocus}>
        {selectedOptions.length > 0 ? (
          <span className={`flex-1 truncate text-[10px] font-medium ${isDark ? "text-blue-300" : "text-brand-blue"}`}>
            {summaryText()}
          </span>
        ) : (
          <span className={`flex-1 text-xs ${isDark ? "text-slate-500" : "text-slate-400 dark:text-slate-500"}`}>
            {placeholder}
          </span>
        )}
        <ChevronDown size={11} className={isDark ? "text-slate-500 shrink-0" : "text-slate-400 dark:text-slate-500 shrink-0"} />
      </div>

      {open && (
        <div className={`absolute top-full left-0 right-0 mt-1 border rounded-md z-50 shadow-lg ${
          isDark ? "bg-gray-900 border-gray-700/60" : "bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700"
        }`}>
          {/* Selected chips (visible when multiple selected) */}
          {selectedOptions.length > 0 && (
            <div className={`flex flex-wrap gap-1 p-2 border-b ${isDark ? "border-gray-700/60" : "border-slate-100 dark:border-gray-700"}`}>
              {selectedOptions.map((o) => (
                <span key={o.value} className="flex items-center gap-0.5 bg-brand-blue text-white text-[10px] px-1.5 py-0.5 rounded">
                  <span className="max-w-[100px] truncate">{o.label}</span>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); toggle(o.value); }}
                    className="hover:opacity-70 shrink-0 ml-0.5"
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className={`px-2 py-1.5 border-b ${isDark ? "border-gray-700/60" : "border-slate-100 dark:border-gray-700"}`}>
            <input
              ref={inputRef}
              className={`w-full text-xs bg-transparent outline-none ${
                isDark ? "text-white placeholder-slate-500" : "text-slate-700 dark:text-slate-200 placeholder-slate-400"
              }`}
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className={`text-xs px-2 py-1.5 italic ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {search ? "Sin resultados" : emptyLabel}
              </p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  onMouseDown={(e) => { e.preventDefault(); toggle(o.value); setSearch(""); }}
                  className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                    isDark
                      ? "text-slate-300 hover:bg-gray-800"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
