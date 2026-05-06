import { useState } from "react";
import { RotateCcw, Bookmark, Plus, Zap, ChevronDown, ChevronUp } from "lucide-react";
import dayjs from "dayjs";
import type { Filters } from "@/lib/filters";
import type { FilterTemplate } from "@/lib/auth";
import type { Freq } from "@/lib/transforms";
import { DateRangePicker } from "./DateRangePicker";
import { MultiSelect } from "./MultiSelect";

interface Props {
  filters: Filters;
  managers: { value: string; label: string }[];
  availableUtms: { sources: string[]; mediums: string[] };
  filterTemplates: FilterTemplate[];
  onFiltersChange: (f: Partial<Filters>) => void;
  onLoad: () => void;
  onReset: () => void;
  onSaveTemplate: (name: string) => void;
  onApplyTemplate: (t: FilterTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  loading: boolean;
  cachedAt: number | null;
  hasApiKey: boolean;
}

const ORDER_TYPES = [
  { code: "crm-license",         label: "💡 License" },
  { code: "sales-and-marketing", label: "🎯 Sales"   },
];

const FREQ_OPTIONS: { label: string; value: Freq }[] = [
  { label: "D", value: "D"  },
  { label: "S", value: "W"  },
  { label: "M", value: "ME" },
];

function sortedStr(arr: string[]) { return [...arr].sort().join("\0"); }

function matchesTemplate(f: Filters, t: FilterTemplate) {
  return (
    f.dateFrom === t.dateFrom && f.dateTo === t.dateTo && f.freq === t.freq &&
    sortedStr(f.selectedTypes) === sortedStr(t.selectedTypes) &&
    sortedStr(f.managerIds)    === sortedStr(t.managerIds)    &&
    sortedStr(f.utmSources)    === sortedStr(t.utmSources)    &&
    sortedStr(f.utmMediums)    === sortedStr(t.utmMediums)
  );
}

export function TopFilters({
  filters, managers, availableUtms, filterTemplates,
  onFiltersChange, onLoad, onReset, onSaveTemplate, onApplyTemplate, onDeleteTemplate,
  loading, cachedAt, hasApiKey,
}: Props) {
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const isCurrentSaved = filterTemplates.some((t) => matchesTemplate(filters, t));
  const hasTemplates = filterTemplates.length > 0;

  function toggleType(code: string) {
    const next = filters.selectedTypes.includes(code)
      ? filters.selectedTypes.filter((c) => c !== code)
      : [...filters.selectedTypes, code];
    onFiltersChange({ selectedTypes: next });
  }

  function handleSave() {
    const name = templateName.trim();
    if (!name) return;
    onSaveTemplate(name);
    setTemplateName("");
    setSavingTemplate(false);
  }

  return (
    <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700 shadow-sm shrink-0">

      {/* ── Main filter row ── */}
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap">

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Mostrar filtros" : "Ocultar filtros"}
          className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors shrink-0"
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {collapsed && (
          <>
            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
              {filters.dateFrom} → {filters.dateTo}
            </span>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                onClick={onLoad}
                disabled={loading || !hasApiKey}
                className="bg-brand-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-1.5 rounded-md transition-colors"
              >
                {loading ? "Cargando…" : "Cargar datos"}
              </button>
            </div>
          </>
        )}

        {!collapsed && (<>

        {/* Date range — compact single button */}
        <DateRangePicker
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={(from, to) => onFiltersChange({ dateFrom: from, dateTo: to })}
          compact
        />

        <div className="w-px h-5 bg-slate-200 dark:bg-gray-700 shrink-0" />

        {/* Frequency tabs */}
        <div className="flex rounded-md border border-slate-200 dark:border-gray-700 overflow-hidden shrink-0">
          {FREQ_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => onFiltersChange({ freq: o.value })}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                filters.freq === o.value
                  ? "bg-brand-blue text-white"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-gray-700 shrink-0" />

        {/* Order type pills */}
        <div className="flex items-center gap-1 shrink-0">
          {ORDER_TYPES.map((t) => {
            const active = filters.selectedTypes.includes(t.code);
            return (
              <button
                key={t.code}
                onClick={() => toggleType(t.code)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  active
                    ? "bg-teal/10 border-teal text-teal"
                    : "border-slate-200 dark:border-gray-700 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-gray-600 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-gray-700 shrink-0" />

        {/* Managers */}
        <div className="w-44 shrink-0">
          <MultiSelect
            variant="light"
            options={managers}
            selected={filters.managerIds}
            onChange={(next) => onFiltersChange({ managerIds: next })}
            placeholder="Asesores"
            emptyLabel="Carga datos primero"
          />
        </div>

        {/* UTM Source */}
        <div className="w-36 shrink-0">
          <MultiSelect
            variant="light"
            options={availableUtms.sources.map((s) => ({ value: s, label: s }))}
            selected={filters.utmSources}
            onChange={(next) => onFiltersChange({ utmSources: next })}
            placeholder="UTM Source"
            emptyLabel="Sin datos"
          />
        </div>

        {/* UTM Medium */}
        <div className="w-36 shrink-0">
          <MultiSelect
            variant="light"
            options={availableUtms.mediums.map((m) => ({ value: m, label: m }))}
            selected={filters.utmMediums}
            onChange={(next) => onFiltersChange({ utmMediums: next })}
            placeholder="UTM Medium"
            emptyLabel="Sin datos"
          />
        </div>

        {/* Right: cache indicator + reset + load */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {cachedAt && !loading && (
            <span className="flex items-center gap-1 text-amber-500 text-[10px]">
              <Zap size={10} />
              {dayjs(cachedAt).format("HH:mm")}
            </span>
          )}

          <button
            onClick={onReset}
            title="Restablecer filtros"
            className="p-1.5 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            <RotateCcw size={13} />
          </button>

          <button
            onClick={onLoad}
            disabled={loading || !hasApiKey}
            className="bg-brand-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-1.5 rounded-md transition-colors"
          >
            {loading ? "Cargando…" : "Cargar datos"}
          </button>
        </div>
        </>)}
      </div>

      {/* ── Templates row ── */}
      {!collapsed && (hasTemplates || !isCurrentSaved) && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/60 overflow-x-auto">
          <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[10px] font-semibold uppercase tracking-wide shrink-0">
            <Bookmark size={9} /> Plantillas
          </span>

          <div className="w-px h-4 bg-slate-200 dark:bg-gray-700 shrink-0" />

          {filterTemplates.map((t) => {
            const isActive = matchesTemplate(filters, t);
            return (
              <div key={t.id} className="flex items-center gap-0.5 shrink-0 group">
                <button
                  onClick={() => onApplyTemplate(t)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    isActive
                      ? "bg-teal/10 border-teal text-teal"
                      : "border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-gray-600 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-transparent"
                  }`}
                >
                  {t.name}
                </button>
                <button
                  onClick={() => onDeleteTemplate(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 dark:text-slate-600 hover:text-red-400 transition-all text-xs leading-none"
                  title="Eliminar"
                >
                  ×
                </button>
              </div>
            );
          })}

          {!isCurrentSaved && (
            savingTemplate ? (
              <div className="flex items-center gap-1 shrink-0">
                <input
                  autoFocus
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") { setSavingTemplate(false); setTemplateName(""); }
                  }}
                  placeholder="Nombre…"
                  className="text-xs border border-teal rounded px-2 py-0.5 outline-none w-28 bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-200"
                />
                <button onClick={handleSave} className="text-teal text-xs font-bold">✓</button>
                <button
                  onClick={() => { setSavingTemplate(false); setTemplateName(""); }}
                  className="text-slate-400 text-xs"
                >✕</button>
              </div>
            ) : (
              <button
                onClick={() => setSavingTemplate(true)}
                className="flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-teal text-[10px] shrink-0 transition-colors"
              >
                <Plus size={9} /> Guardar filtro actual
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
