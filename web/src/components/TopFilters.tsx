import { useState, useRef, useEffect } from "react";
import { RotateCcw, Bookmark, Plus, Zap, ChevronDown, ChevronUp, Info, Settings2, ChevronUp as Up, ChevronDown as Down } from "lucide-react";
import dayjs from "dayjs";
import type { Filters } from "@/lib/filters";
import type { FilterTemplate } from "@/lib/auth";
import type { Freq } from "@/lib/transforms";
import { DateRangePicker } from "./DateRangePicker";
import { MultiSelect } from "./MultiSelect";

// ── Tooltip label ────────────────────────────────────────────────────────────
function FL({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-0.5">
      {label}
      <span className="relative group/tip cursor-help">
        <Info size={9} className="text-slate-300 dark:text-slate-600 group-hover/tip:text-slate-500 dark:group-hover/tip:text-slate-400 transition-colors" />
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/tip:block z-[60] pointer-events-none w-52">
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200 font-normal normal-case tracking-normal leading-relaxed">
            {tip}
          </div>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white dark:bg-gray-800 border-l border-t border-slate-200 dark:border-gray-700 rotate-45" />
        </div>
      </span>
    </span>
  );
}

// ── Filter layout configurator ───────────────────────────────────────────────
const FILTER_DEFS = [
  { id: "creation-date",       label: "Fecha de creación" },
  { id: "first-payment-date",  label: "Fecha de primer pago" },
  { id: "freq",                label: "Agrupación" },
  { id: "order-type",          label: "Tipo de pedido" },
  { id: "manager",             label: "Asesor" },
  { id: "utm-source",          label: "UTM Source" },
  { id: "utm-medium",          label: "UTM Medium" },
] as const;

type FilterId = (typeof FILTER_DEFS)[number]["id"];
interface LayoutItem { id: FilterId; visible: boolean; }

function loadLayout(): LayoutItem[] {
  try {
    const saved = localStorage.getItem("simla_filter_layout");
    if (saved) {
      const parsed = JSON.parse(saved) as LayoutItem[];
      const ids = new Set(parsed.map((p) => p.id));
      const missing = FILTER_DEFS.filter((f) => !ids.has(f.id)).map((f) => ({ id: f.id, visible: true }));
      return [...parsed, ...missing];
    }
  } catch { /* ignore */ }
  return FILTER_DEFS.map((f) => ({ id: f.id, visible: true }));
}

function saveLayout(l: LayoutItem[]) {
  localStorage.setItem("simla_filter_layout", JSON.stringify(l));
}

// ── Props ────────────────────────────────────────────────────────────────────
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
  { code: "crm-license",         label: "💡 System License"    },
  { code: "sales-and-marketing", label: "🎯 Sales & Marketing" },
];

const FREQ_OPTIONS: { label: string; value: Freq; title: string }[] = [
  { label: "Día", value: "D",  title: "Diario"   },
  { label: "Sem", value: "W",  title: "Semanal"  },
  { label: "Mes", value: "ME", title: "Mensual"  },
];

const dateCls = "text-xs border border-slate-200 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-blue w-32";

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

// ── Component ────────────────────────────────────────────────────────────────
export function TopFilters({
  filters, managers, availableUtms, filterTemplates,
  onFiltersChange, onLoad, onReset, onSaveTemplate, onApplyTemplate, onDeleteTemplate,
  loading, cachedAt, hasApiKey,
}: Props) {
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [layout, setLayout] = useState<LayoutItem[]>(loadLayout);
  const [showConfig, setShowConfig] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setShowConfig(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isCurrentSaved = filterTemplates.some((t) => matchesTemplate(filters, t));
  const hasTemplates = filterTemplates.length > 0;

  function toggleType(code: string) {
    onFiltersChange({
      selectedTypes: filters.selectedTypes.includes(code)
        ? filters.selectedTypes.filter((c) => c !== code)
        : [...filters.selectedTypes, code],
    });
  }

  function handleSave() {
    const name = templateName.trim();
    if (!name) return;
    onSaveTemplate(name);
    setTemplateName("");
    setSavingTemplate(false);
  }

  function toggleVisible(id: FilterId) {
    const next = layout.map((item) => item.id === id ? { ...item, visible: !item.visible } : item);
    setLayout(next);
    saveLayout(next);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...layout];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setLayout(next);
    saveLayout(next);
  }

  function moveDown(idx: number) {
    if (idx === layout.length - 1) return;
    const next = [...layout];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setLayout(next);
    saveLayout(next);
  }

  const visibleIds = layout.filter((l) => l.visible).map((l) => l.id);

  function renderFilter(id: FilterId) {
    switch (id) {
      case "creation-date":
        return (
          <div key="creation-date" className="flex flex-col gap-1 shrink-0">
            <FL label="Fecha de creación del pedido" tip="Filtra pedidos por su fecha de creación en Simla. Deja vacío para ignorar este criterio." />
            <div className="flex items-center gap-1">
              <DateRangePicker
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
                onChange={(from, to) => onFiltersChange({ dateFrom: from, dateTo: to })}
                compact
              />
              {(filters.dateFrom || filters.dateTo) && (
                <button
                  onClick={() => onFiltersChange({ dateFrom: "", dateTo: "" })}
                  title="Limpiar fecha de creación"
                  className="text-slate-300 hover:text-red-400 dark:text-slate-600 dark:hover:text-red-400 text-sm leading-none transition-colors"
                >×</button>
              )}
            </div>
          </div>
        );

      case "first-payment-date":
        return (
          <div key="first-payment-date" className="flex flex-col gap-1 shrink-0">
            <FL label="Fecha de primer pago" tip="Filtra pedidos por el campo personalizado 'firstpaymentdate'. Independiente de la fecha de creación. Deja vacío para ignorar." />
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={filters.firstPaymentFrom}
                onChange={(e) => onFiltersChange({ firstPaymentFrom: e.target.value })}
                className={dateCls}
              />
              <span className="text-slate-400 dark:text-slate-600 text-xs">→</span>
              <input
                type="date"
                value={filters.firstPaymentTo}
                onChange={(e) => onFiltersChange({ firstPaymentTo: e.target.value })}
                className={dateCls}
              />
              {(filters.firstPaymentFrom || filters.firstPaymentTo) && (
                <button
                  onClick={() => onFiltersChange({ firstPaymentFrom: "", firstPaymentTo: "" })}
                  title="Limpiar fecha de primer pago"
                  className="text-slate-300 hover:text-red-400 dark:text-slate-600 dark:hover:text-red-400 text-sm leading-none transition-colors"
                >×</button>
              )}
            </div>
          </div>
        );

      case "freq":
        return (
          <div key="freq" className="flex flex-col gap-1 shrink-0">
            <FL label="Agrupación" tip="Cómo se agrupan los datos en las gráficas de tiempo: por día, semana o mes." />
            <div className="flex rounded-md border border-slate-200 dark:border-gray-700 overflow-hidden">
              {FREQ_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => onFiltersChange({ freq: o.value })}
                  title={o.title}
                  className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    filters.freq === o.value
                      ? "bg-brand-blue text-white"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800"
                  }`}
                >{o.label}</button>
              ))}
            </div>
          </div>
        );

      case "order-type":
        return (
          <div key="order-type" className="flex flex-col gap-1 shrink-0">
            <FL label="Tipo de pedido" tip="Filtra por tipo de pedido. Selecciona uno o ambos para combinarlos." />
            <div className="flex items-center gap-1">
              {ORDER_TYPES.map((t) => {
                const active = filters.selectedTypes.includes(t.code);
                return (
                  <button
                    key={t.code}
                    onClick={() => toggleType(t.code)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      active
                        ? "bg-brand-blue/10 border-brand-blue text-brand-blue"
                        : "border-slate-200 dark:border-gray-700 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-gray-600 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >{t.label}</button>
                );
              })}
            </div>
          </div>
        );

      case "manager":
        return (
          <div key="manager" className="flex flex-col gap-1 w-44 shrink-0">
            <FL label="Asesor" tip="Filtra pedidos por el asesor responsable asignado." />
            <MultiSelect
              variant="light"
              options={managers}
              selected={filters.managerIds}
              onChange={(next) => onFiltersChange({ managerIds: next })}
              placeholder="Todos"
              emptyLabel="Carga datos primero"
            />
          </div>
        );

      case "utm-source":
        return (
          <div key="utm-source" className="flex flex-col gap-1 w-36 shrink-0">
            <FL label="UTM Source" tip="Fuente de tráfico del pedido (ej. google, facebook, email)." />
            <MultiSelect
              variant="light"
              options={availableUtms.sources.map((s) => ({ value: s, label: s }))}
              selected={filters.utmSources}
              onChange={(next) => onFiltersChange({ utmSources: next })}
              placeholder="Todos"
              emptyLabel="Sin datos"
            />
          </div>
        );

      case "utm-medium":
        return (
          <div key="utm-medium" className="flex flex-col gap-1 w-36 shrink-0">
            <FL label="UTM Medium" tip="Medio de tráfico del pedido (ej. cpc, organic, referral)." />
            <MultiSelect
              variant="light"
              options={availableUtms.mediums.map((m) => ({ value: m, label: m }))}
              selected={filters.utmMediums}
              onChange={(next) => onFiltersChange({ utmMediums: next })}
              placeholder="Todos"
              emptyLabel="Sin datos"
            />
          </div>
        );

      default:
        return null;
    }
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
              {filters.dateFrom || "—"} → {filters.dateTo || "—"}
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
          {/* Labeled filter groups — visible filters in configured order */}
          <div className="flex items-end gap-3 flex-wrap flex-1">
            {visibleIds.map((id, i) => (
              <div key={id} className="flex items-end gap-3">
                {i > 0 && <div className="w-px h-7 bg-slate-200 dark:bg-gray-700 shrink-0 self-end mb-0.5" />}
                {renderFilter(id)}
              </div>
            ))}
          </div>

          {/* Gear: configure visible filters */}
          <div ref={configRef} className="relative shrink-0 self-end mb-0.5">
            <button
              onClick={() => setShowConfig((v) => !v)}
              title="Configurar filtros"
              className={`p-1.5 rounded-md transition-colors ${showConfig ? "bg-brand-blue/10 text-brand-blue" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800"}`}
            >
              <Settings2 size={14} />
            </button>

            {showConfig && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg p-3 w-60">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Configurar filtros</p>
                <div className="flex flex-col gap-1.5">
                  {layout.map((item, idx) => {
                    const def = FILTER_DEFS.find((f) => f.id === item.id);
                    if (!def) return null;
                    return (
                      <div key={item.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.visible}
                          onChange={() => toggleVisible(item.id)}
                          className="cursor-pointer accent-brand-blue"
                        />
                        <span className="text-xs text-slate-700 dark:text-slate-200 flex-1 truncate">{def.label}</span>
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => moveUp(idx)}
                            disabled={idx === 0}
                            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20 transition-colors"
                          ><Up size={10} /></button>
                          <button
                            onClick={() => moveDown(idx)}
                            disabled={idx === layout.length - 1}
                            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20 transition-colors"
                          ><Down size={10} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: cache + reset + load */}
          <div className="flex items-center gap-2 shrink-0 self-end mb-0.5">
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
                      ? "bg-brand-blue/10 border-brand-blue text-brand-blue"
                      : "border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-gray-600 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-transparent"
                  }`}
                >{t.name}</button>
                <button
                  onClick={() => onDeleteTemplate(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 dark:text-slate-600 hover:text-red-400 transition-all text-xs leading-none"
                  title="Eliminar"
                >×</button>
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
                  className="text-xs border border-brand-blue rounded px-2 py-0.5 outline-none w-28 bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-200"
                />
                <button onClick={handleSave} className="text-brand-blue text-xs font-bold">✓</button>
                <button
                  onClick={() => { setSavingTemplate(false); setTemplateName(""); }}
                  className="text-slate-400 text-xs"
                >✕</button>
              </div>
            ) : (
              <button
                onClick={() => setSavingTemplate(true)}
                className="flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-brand-blue text-[10px] shrink-0 transition-colors"
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
