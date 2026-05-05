import { NavLink, useNavigate } from "react-router-dom";
import { BarChart3, TrendingDown, Filter, ShieldCheck, LogOut } from "lucide-react";
import dayjs from "dayjs";
import type { Freq } from "@/lib/transforms";
import type { SimlaUser } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";

export interface Filters {
  dateFrom: string;
  dateTo: string;
  freq: Freq;
  selectedTypes: string[];
  managerIds: string[];
  utmSources: string[];
  utmMediums: string[];
}

interface AvailableUtms {
  sources: string[];
  mediums: string[];
}

interface Props {
  filters: Filters;
  managers: SimlaUser[];
  availableUtms: AvailableUtms;
  onFiltersChange: (f: Partial<Filters>) => void;
  onLoad: () => void;
  loading: boolean;
}

const HARDCODED_ORDER_TYPES = [
  { code: "crm-license",         label: "💡 SYSTEM LICENSE" },
  { code: "sales-and-marketing", label: "🎯 SALES AND MARKETING" },
];

const NAV_ITEMS = [
  { to: "/",       label: "Analíticas generales", icon: BarChart3 },
  { to: "/funnel", label: "Etapas del embudo",    icon: TrendingDown },
];

const FREQ_OPTIONS: { label: string; value: Freq }[] = [
  { label: "Diario",   value: "D"  },
  { label: "Semanal",  value: "W"  },
  { label: "Mensual",  value: "ME" },
];

const DATE_PRESETS = [
  { label: "Ayer",   dateFrom: () => dayjs().subtract(1, "day").format("YYYY-MM-DD"),   dateTo: () => dayjs().subtract(1, "day").format("YYYY-MM-DD") },
  { label: "7d",     dateFrom: () => dayjs().subtract(7, "day").format("YYYY-MM-DD"),   dateTo: () => dayjs().format("YYYY-MM-DD") },
  { label: "1m",     dateFrom: () => dayjs().subtract(30, "day").format("YYYY-MM-DD"),  dateTo: () => dayjs().format("YYYY-MM-DD") },
  { label: "6m",     dateFrom: () => dayjs().subtract(180, "day").format("YYYY-MM-DD"), dateTo: () => dayjs().format("YYYY-MM-DD") },
  { label: "1a",     dateFrom: () => dayjs().subtract(365, "day").format("YYYY-MM-DD"), dateTo: () => dayjs().format("YYYY-MM-DD") },
];

function CheckList({
  items,
  selected,
  onChange,
  emptyLabel,
}: {
  items: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
}) {
  if (items.length === 0)
    return <p className="text-slate-600 text-xs italic">{emptyLabel}</p>;

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  }

  return (
    <div className="flex flex-col gap-1 max-h-28 overflow-y-auto pr-1">
      {items.map(({ value, label }) => (
        <label key={value} className="flex items-center gap-2 text-slate-300 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={selected.includes(value)}
            onChange={() => toggle(value)}
            className="accent-teal"
          />
          <span className="truncate">{label}</span>
        </label>
      ))}
    </div>
  );
}

export function Sidebar({ filters, managers, availableUtms, onFiltersChange, onLoad, loading }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="w-64 h-screen sticky top-0 overflow-y-auto bg-navy flex flex-col p-4 gap-3 shrink-0">

      {/* ── Brand ── */}
      <div className="flex items-center gap-3 pb-3 border-b border-navy-border">
        <div className="w-9 h-9 rounded-lg bg-teal flex items-center justify-center text-white font-bold text-lg shrink-0">S</div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">Simla Analíticas</p>
          <p className="text-slate-500 text-xs">Panel de ventas · CRM</p>
        </div>
        {user?.role === "admin" && (
          <button
            onClick={() => navigate("/admin")}
            title="Panel de administración"
            className="text-slate-500 hover:text-white transition-colors shrink-0"
          >
            <ShieldCheck size={16} />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-brand-blue text-white font-semibold"
                  : "text-slate-400 hover:bg-navy-border hover:text-white"
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      <hr className="border-navy-border" />

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3">
        <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1">
          <Filter size={10} /> Filtros
        </p>

        {/* Date presets */}
        <div className="flex gap-1 flex-wrap">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => onFiltersChange({ dateFrom: p.dateFrom(), dateTo: p.dateTo() })}
              className="px-2 py-0.5 text-[10px] rounded bg-navy-border text-slate-300 hover:bg-teal hover:text-white transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-slate-400 text-xs mb-1">Desde</label>
            <input
              type="date"
              value={filters.dateFrom}
              max={filters.dateTo}
              onChange={(e) => onFiltersChange({ dateFrom: e.target.value })}
              className="w-full bg-navy-border text-white text-xs rounded-md px-2 py-1.5 border border-navy-border focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
          <div className="flex-1">
            <label className="block text-slate-400 text-xs mb-1">Hasta</label>
            <input
              type="date"
              value={filters.dateTo}
              min={filters.dateFrom}
              max={dayjs().format("YYYY-MM-DD")}
              onChange={(e) => onFiltersChange({ dateTo: e.target.value })}
              className="w-full bg-navy-border text-white text-xs rounded-md px-2 py-1.5 border border-navy-border focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
        </div>

        {/* Granularity */}
        <div>
          <label className="block text-slate-400 text-xs mb-1">Granularidad</label>
          <select
            value={filters.freq}
            onChange={(e) => onFiltersChange({ freq: e.target.value as Freq })}
            className="w-full bg-navy-border text-white text-sm rounded-md px-3 py-1.5 border border-navy-border focus:outline-none focus:ring-1 focus:ring-teal"
          >
            {FREQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Order types */}
        <div>
          <label className="block text-slate-400 text-xs mb-1">Tipo de pedido</label>
          <CheckList
            items={HARDCODED_ORDER_TYPES.map((t) => ({ value: t.code, label: t.label }))}
            selected={filters.selectedTypes}
            onChange={(next) => onFiltersChange({ selectedTypes: next })}
            emptyLabel=""
          />
        </div>

        {/* Managers */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-slate-400 text-xs">Asesores</label>
            {filters.managerIds.length > 0 && (
              <button onClick={() => onFiltersChange({ managerIds: [] })} className="text-slate-500 hover:text-slate-300 text-[10px]">
                Limpiar
              </button>
            )}
          </div>
          <CheckList
            items={managers.map((m) => ({ value: String(m.id), label: `${m.firstName} ${m.lastName}` }))}
            selected={filters.managerIds}
            onChange={(next) => onFiltersChange({ managerIds: next })}
            emptyLabel="Cargando asesores…"
          />
        </div>

        {/* UTM Source */}
        {availableUtms.sources.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 text-xs">UTM Source</label>
              {filters.utmSources.length > 0 && (
                <button onClick={() => onFiltersChange({ utmSources: [] })} className="text-slate-500 hover:text-slate-300 text-[10px]">
                  Limpiar
                </button>
              )}
            </div>
            <CheckList
              items={availableUtms.sources.map((s) => ({ value: s, label: s }))}
              selected={filters.utmSources}
              onChange={(next) => onFiltersChange({ utmSources: next })}
              emptyLabel=""
            />
          </div>
        )}

        {/* UTM Medium */}
        {availableUtms.mediums.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 text-xs">UTM Medium</label>
              {filters.utmMediums.length > 0 && (
                <button onClick={() => onFiltersChange({ utmMediums: [] })} className="text-slate-500 hover:text-slate-300 text-[10px]">
                  Limpiar
                </button>
              )}
            </div>
            <CheckList
              items={availableUtms.mediums.map((m) => ({ value: m, label: m }))}
              selected={filters.utmMediums}
              onChange={(next) => onFiltersChange({ utmMediums: next })}
              emptyLabel=""
            />
          </div>
        )}
      </div>

      {/* ── Bottom: load + profile ── */}
      <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-navy-border">
        {!user?.apiKey && (
          <p className="text-amber-400 text-xs text-center">
            Configura tu API Key en{" "}
            <button className="underline" onClick={() => navigate("/profile")}>Mi perfil</button>
          </p>
        )}

        <button
          onClick={onLoad}
          disabled={loading || !user?.apiKey}
          className="w-full bg-brand-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2 rounded-md transition-colors"
        >
          {loading ? "Cargando…" : "Cargar datos"}
        </button>

        {user && (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2 cursor-pointer hover:bg-navy-border rounded-md px-2 py-1.5 transition-colors min-w-0"
              onClick={() => navigate("/profile")}
            >
              <Avatar
                firstName={user.firstName}
                lastName={user.lastName}
                avatarDataUrl={user.avatarDataUrl}
                size={28}
              />
              <div className="overflow-hidden">
                <p className="text-white text-xs font-semibold truncate">{user.firstName} {user.lastName}</p>
                <p className="text-slate-500 text-[10px] truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="text-slate-500 hover:text-red-400 transition-colors shrink-0 p-1.5 rounded hover:bg-navy-border"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
