import { useState, useRef, useEffect } from "react";
import { Bookmark, Plus, Zap, Info, Settings2, GripVertical, X, RotateCcw, Check } from "lucide-react";
import dayjs from "dayjs";
import { useT } from "@/contexts/I18nContext";
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

const DEFAULT_LAYOUT: LayoutItem[] = FILTER_DEFS.map((f) => ({ id: f.id, visible: true }));

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
  return DEFAULT_LAYOUT;
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
  { value: "crm-license",         label: "💡 System License"    },
  { value: "sales-and-marketing", label: "🎯 Sales & Marketing" },
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

// Approximate height of the FL label row so non-label items align with controls
const LABEL_H = "mt-[18px]";

// ── Component ────────────────────────────────────────────────────────────────
export function TopFilters({
  filters, managers, availableUtms, filterTemplates,
  onFiltersChange, onLoad, onReset, onSaveTemplate, onApplyTemplate, onDeleteTemplate,
  loading, cachedAt, hasApiKey,
}: Props) {
  const t = useT();

  const FREQ_OPTIONS: { label: string; value: Freq; title: string }[] = [
    { label: t("filter_freq_day"),   value: "D",  title: t("filter_freq_day_title")   },
    { label: t("filter_freq_week"),  value: "W",  title: t("filter_freq_week_title")  },
    { label: t("filter_freq_month"), value: "ME", title: t("filter_freq_month_title") },
  ];

  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [layout, setLayout] = useState<LayoutItem[]>(loadLayout);
  const [showConfig, setShowConfig] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const dragIdx = useRef<number | null>(null);

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

  function handleDragStart(idx: number) {
    dragIdx.current = idx;
    setDraggingIdx(idx);
  }

  function handleDragEnd() {
    dragIdx.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  function handleDrop(idx: number) {
    if (dragIdx.current !== null && dragIdx.current !== idx) {
      const next = [...layout];
      const [moved] = next.splice(dragIdx.current, 1);
      next.splice(idx, 0, moved);
      setLayout(next);
      saveLayout(next);
    }
    dragIdx.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }

  const visibleIds = layout.filter((l) => l.visible).map((l) => l.id);

  function renderFilter(id: FilterId) {
    switch (id) {
      case "creation-date":
        return (
          <div key="creation-date" className="flex flex-col gap-1 shrink-0">
            <FL label={t("filter_creation_date")} tip={t("tip_creation_date")} />
            <div className="flex items-center gap-1">
              <DateRangePicker
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
                onChange={(from, to) => onFiltersChange({ dateFrom: from, dateTo: to })}
                compact
              />
              {(filters.dateFrom || filters.dateTo) && (
                <button onClick={() => onFiltersChange({ dateFrom: "", dateTo: "" })} title={t("filter_clear")} className="text-slate-300 hover:text-red-400 dark:text-slate-600 dark:hover:text-red-400 text-sm leading-none transition-colors">×</button>
              )}
            </div>
          </div>
        );

      case "first-payment-date":
        return (
          <div key="first-payment-date" className="flex flex-col gap-1 shrink-0">
            <FL label={t("filter_first_payment")} tip={t("tip_first_payment")} />
            <div className="flex items-center gap-1">
              <DateRangePicker
                dateFrom={filters.firstPaymentFrom}
                dateTo={filters.firstPaymentTo}
                onChange={(from, to) => onFiltersChange({ firstPaymentFrom: from, firstPaymentTo: to })}
                compact
              />
              {(filters.firstPaymentFrom || filters.firstPaymentTo) && (
                <button onClick={() => onFiltersChange({ firstPaymentFrom: "", firstPaymentTo: "" })} title={t("filter_clear")} className="text-slate-300 hover:text-red-400 dark:text-slate-600 dark:hover:text-red-400 text-sm leading-none transition-colors">×</button>
              )}
            </div>
          </div>
        );

      case "freq":
        return (
          <div key="freq" className="flex flex-col gap-1 shrink-0">
            <FL label={t("filter_grouping")} tip={t("tip_grouping")} />
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
          <div key="order-type" className="flex flex-col gap-1 w-48 shrink-0">
            <FL label={t("filter_order_type")} tip={t("tip_order_type")} />
            <MultiSelect variant="light" options={ORDER_TYPES} selected={filters.selectedTypes} onChange={(next) => onFiltersChange({ selectedTypes: next })} placeholder={t("filter_all")} emptyLabel={t("filter_no_data")} />
          </div>
        );

      case "manager":
        return (
          <div key="manager" className="flex flex-col gap-1 w-44 shrink-0">
            <FL label={t("filter_manager")} tip={t("tip_manager")} />
            <MultiSelect variant="light" options={managers} selected={filters.managerIds} onChange={(next) => onFiltersChange({ managerIds: next })} placeholder={t("filter_all")} emptyLabel={t("filter_load_first")} />
          </div>
        );

      case "utm-source":
        return (
          <div key="utm-source" className="flex flex-col gap-1 w-36 shrink-0">
            <FL label={t("filter_utm_source")} tip={t("tip_utm_source")} />
            <MultiSelect variant="light" options={availableUtms.sources.map((s) => ({ value: s, label: s }))} selected={filters.utmSources} onChange={(next) => onFiltersChange({ utmSources: next })} placeholder={t("filter_all")} emptyLabel={t("filter_no_data")} />
          </div>
        );

      case "utm-medium":
        return (
          <div key="utm-medium" className="flex flex-col gap-1 w-36 shrink-0">
            <FL label={t("filter_utm_medium")} tip={t("tip_utm_medium")} />
            <MultiSelect variant="light" options={availableUtms.mediums.map((m) => ({ value: m, label: m }))} selected={filters.utmMediums} onChange={(next) => onFiltersChange({ utmMediums: next })} placeholder={t("filter_all")} emptyLabel={t("filter_no_data")} />
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700 shadow-sm shrink-0">

      {/* ── Filter row — always visible ── */}
      <div className="flex items-start gap-2 px-4 py-2 flex-wrap">

        {/* Filter columns — top-aligned */}
        <div className="flex items-start gap-3 flex-wrap flex-1">
          {visibleIds.map((id, i) => (
            <div key={id} className="flex items-start gap-3">
              {i > 0 && <div className={`w-px h-6 bg-slate-200 dark:bg-gray-700 shrink-0 ${LABEL_H}`} />}
              {renderFilter(id)}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className={`flex items-center gap-1 shrink-0 ${LABEL_H}`}>
          <button onClick={onReset} title={t("filter_reset_title")} className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <X size={13} />
          </button>

          {/* Gear config */}
          <div ref={configRef} className="relative">
            <button
              onClick={() => setShowConfig((v) => !v)}
              title={t("filter_config_title")}
              className={`p-1.5 rounded-md transition-colors ${showConfig ? "bg-brand-blue/10 text-brand-blue" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800"}`}
            >
              <Settings2 size={14} />
            </button>

            {showConfig && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg p-3 w-56">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t("filter_config_title")}</p>
                  <button onClick={resetLayout} title={t("filter_config_reset")} className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-slate-500 hover:text-brand-blue transition-colors">
                    <RotateCcw size={9} /> {t("filter_config_reset")}
                  </button>
                </div>
                <div className="flex flex-col">
                  {layout.map((item, idx) => {
                    const def = FILTER_DEFS.find((f) => f.id === item.id);
                    if (!def) return null;
                    const isTarget = dragOverIdx === idx && draggingIdx !== idx;
                    const isDragging = draggingIdx === idx;
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                        onDragLeave={() => setDragOverIdx(null)}
                        onDrop={() => handleDrop(idx)}
                        className={`flex items-center gap-2 py-1.5 px-1 rounded cursor-grab active:cursor-grabbing transition-all select-none
                          ${isDragging ? "opacity-30" : ""}
                          ${isTarget ? "bg-brand-blue/10 border-t-2 border-brand-blue" : "border-t-2 border-transparent hover:bg-slate-50 dark:hover:bg-gray-700"}`}
                      >
                        <GripVertical size={11} className="text-slate-300 dark:text-slate-600 shrink-0" />
                        <input type="checkbox" checked={item.visible} onChange={() => toggleVisible(item.id)} className="cursor-pointer accent-brand-blue shrink-0" />
                        <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{def.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {cachedAt && !loading && (
            <span title={`${t("filter_cache_tooltip")} ${dayjs(cachedAt).format("HH:mm")}`} className="flex items-center gap-1 text-amber-500 text-[10px] cursor-help px-1">
              <Zap size={10} />
              {dayjs(cachedAt).format("HH:mm")}
            </span>
          )}

          <button onClick={onLoad} disabled={loading || !hasApiKey} className="bg-brand-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-1.5 rounded-md transition-colors">
            {loading ? t("filter_loading") : t("filter_load")}
          </button>
        </div>
      </div>

      {/* ── Templates row ── */}
      {(hasTemplates || !isCurrentSaved) && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/60 overflow-x-auto">
          <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[10px] font-semibold uppercase tracking-wide shrink-0">
            <Bookmark size={9} /> {t("filter_templates_label")}
          </span>
          <div className="w-px h-4 bg-slate-200 dark:bg-gray-700 shrink-0" />
          {filterTemplates.map((tmpl) => {
            const isActive = matchesTemplate(filters, tmpl);
            return (
              <div key={tmpl.id} className="flex items-center gap-0.5 shrink-0 group">
                <button
                  onClick={() => onApplyTemplate(tmpl)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    isActive
                      ? "bg-brand-blue/10 border-brand-blue text-brand-blue"
                      : "border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-gray-600 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-transparent"
                  }`}
                >{tmpl.name}</button>
                <button onClick={() => onDeleteTemplate(tmpl.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 dark:text-slate-600 hover:text-red-400 transition-all text-xs leading-none" title={t("admin_delete")}>×</button>
              </div>
            );
          })}
          {!isCurrentSaved && (
            savingTemplate ? (
              <div className="flex items-center gap-1.5 shrink-0 bg-white dark:bg-gray-900 border border-brand-blue/60 rounded-lg px-2 py-1 shadow-sm ring-1 ring-brand-blue/20">
                <Bookmark size={11} className="text-brand-blue shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") { setSavingTemplate(false); setTemplateName(""); }
                  }}
                  placeholder={t("filter_template_placeholder")}
                  className="text-xs outline-none w-36 bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <button
                  onClick={handleSave}
                  title="Guardar"
                  className="flex items-center justify-center w-5 h-5 rounded-md bg-brand-blue hover:bg-blue-700 text-white transition-colors shrink-0"
                >
                  <Check size={11} />
                </button>
                <button
                  onClick={() => { setSavingTemplate(false); setTemplateName(""); }}
                  title="Cancelar"
                  className="flex items-center justify-center w-5 h-5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                >
                  <X size={11} />
                </button>
              </div>
            ) : (
              <button onClick={() => setSavingTemplate(true)} className="flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-brand-blue text-[10px] shrink-0 transition-colors">
                <Plus size={9} /> {t("filter_save_current")}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
