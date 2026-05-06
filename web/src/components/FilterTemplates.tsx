import { useState } from "react";
import { Grip, Trash2, Plus } from "lucide-react";
import type { FilterTemplate } from "@/lib/auth";
import type { Filters } from "@/lib/filters";

interface Props {
  templates: FilterTemplate[];
  currentFilters: Filters;
  onApply: (t: FilterTemplate) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  onReorder: (templates: FilterTemplate[]) => void;
}

function sortedStr(arr: string[]) {
  return [...arr].sort().join("\0");
}

function filtersMatchTemplate(filters: Filters, t: FilterTemplate): boolean {
  return (
    filters.dateFrom === t.dateFrom &&
    filters.dateTo === t.dateTo &&
    filters.freq === t.freq &&
    sortedStr(filters.selectedTypes) === sortedStr(t.selectedTypes) &&
    sortedStr(filters.managerIds) === sortedStr(t.managerIds) &&
    sortedStr(filters.utmSources) === sortedStr(t.utmSources) &&
    sortedStr(filters.utmMediums) === sortedStr(t.utmMediums)
  );
}

export function FilterTemplates({ templates, currentFilters, onApply, onSave, onDelete, onReorder }: Props) {
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const isCurrentSaved = templates.some((t) => filtersMatchTemplate(currentFilters, t));

  function handleSave() {
    const name = newName.trim();
    if (!name) return;
    onSave(name);
    setNewName("");
    setSaving(false);
  }

  function handleDragStart(i: number) { setDragIndex(i); }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOverIndex(i);
  }

  function handleDrop(i: number) {
    if (dragIndex === null || dragIndex === i) return;
    const reordered = [...templates];
    const [item] = reordered.splice(dragIndex, 1);
    reordered.splice(i, 0, item);
    onReorder(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div className="flex flex-col gap-1">
      {templates.map((t, i) => {
        const isActive = filtersMatchTemplate(currentFilters, t);
        const isDragTarget = dragOverIndex === i && dragIndex !== i;
        return (
          <div
            key={t.id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            onDragEnd={handleDragEnd}
            onClick={() => onApply(t)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer group transition-all ${
              isActive
                ? "bg-teal/20 ring-1 ring-teal"
                : "bg-navy-border hover:bg-[#1a2233]"
            } ${isDragTarget ? "ring-1 ring-teal/60 opacity-60" : ""}`}
          >
            <Grip size={11} className="text-slate-600 cursor-grab shrink-0" onMouseDown={(e) => e.stopPropagation()} />
            <span className="flex-1 text-slate-300 text-xs truncate">{t.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
              className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
            >
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}

      {!isCurrentSaved && (
        saving ? (
          <div className="flex gap-1 mt-1">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") { setSaving(false); setNewName(""); }
              }}
              className="flex-1 min-w-0 bg-navy-border text-white text-xs rounded-md px-2 py-1 border border-teal focus:outline-none"
            />
            <button onClick={handleSave} className="text-teal hover:text-white text-xs font-bold px-1 shrink-0">✓</button>
            <button onClick={() => { setSaving(false); setNewName(""); }} className="text-slate-500 hover:text-slate-300 text-xs px-1 shrink-0">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setSaving(true)}
            className="flex items-center gap-1 text-slate-500 hover:text-teal transition-colors text-[10px] mt-1 self-start"
          >
            <Plus size={10} /> Guardar filtro actual
          </button>
        )
      )}
    </div>
  );
}
