import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

interface Option { value: string; label: string; }

interface Props {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
}

export function MultiSelect({ options, selected, onChange, placeholder = "Buscar…", emptyLabel = "Sin opciones" }: Props) {
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

  return (
    <div ref={containerRef} className="flex flex-col gap-1">
      <div
        className="flex flex-wrap gap-1 items-center bg-navy-border border border-navy-border rounded-md px-2 py-1 min-h-[30px] cursor-text"
        onClick={() => setOpen(true)}
      >
        {selectedOptions.map((o) => (
          <span key={o.value} className="flex items-center gap-0.5 bg-teal text-white text-[10px] px-1.5 py-0.5 rounded">
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
          className="flex-1 min-w-[50px] text-xs bg-transparent text-white placeholder-slate-500 outline-none"
          placeholder={selected.length === 0 ? placeholder : ""}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && (
        <div className="bg-[#1a2233] border border-navy-border rounded-md max-h-36 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-slate-500 text-xs px-2 py-1.5 italic">
              {search ? "Sin resultados" : emptyLabel}
            </p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                onClick={() => { toggle(o.value); setSearch(""); }}
                className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-navy-border transition-colors"
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
