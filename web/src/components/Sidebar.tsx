import { NavLink } from "react-router-dom";
import { BarChart3, TrendingDown, Settings, Filter } from "lucide-react";
import dayjs from "dayjs";
import type { Freq } from "@/lib/transforms";
import type { OrderType } from "@/lib/api";

export interface Filters {
  apiKey: string;
  dateFrom: string;
  dateTo: string;
  freq: Freq;
  selectedTypes: string[];
  managerId: string;
}

interface Props {
  filters: Filters;
  orderTypes: OrderType[];
  onFiltersChange: (f: Partial<Filters>) => void;
  onLoad: () => void;
  loading: boolean;
}

const NAV_ITEMS = [
  { to: "/", label: "Analíticas generales", icon: BarChart3 },
  { to: "/funnel", label: "Этапы воронки", icon: TrendingDown },
];

const FREQ_OPTIONS: { label: string; value: Freq }[] = [
  { label: "Diario", value: "D" },
  { label: "Semanal", value: "W" },
  { label: "Mensual", value: "ME" },
];

export function Sidebar({ filters, orderTypes, onFiltersChange, onLoad, loading }: Props) {
  return (
    <aside className="w-64 min-h-screen bg-navy flex flex-col p-4 gap-4 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 pb-4 border-b border-navy-border">
        <div className="w-9 h-9 rounded-lg bg-teal flex items-center justify-center text-white font-bold text-lg">S</div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Simla Analíticas</p>
          <p className="text-slate-500 text-xs">Panel de ventas · CRM</p>
        </div>
      </div>

      {/* Nav */}
      <div>
        <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest mb-2 flex items-center gap-1">
          <BarChart3 size={10} /> Navegación
        </p>
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
      </div>

      <hr className="border-navy-border" />

      {/* API Key */}
      <div>
        <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest mb-2 flex items-center gap-1">
          <Settings size={10} /> Configuración
        </p>
        <label className="block text-slate-400 text-xs mb-1">API Key</label>
        <input
          type="password"
          value={filters.apiKey}
          onChange={(e) => onFiltersChange({ apiKey: e.target.value })}
          placeholder="Ingresa tu API Key"
          className="w-full bg-navy-border text-white text-sm rounded-md px-3 py-1.5 border border-navy-border focus:outline-none focus:ring-1 focus:ring-teal placeholder:text-slate-600"
        />
      </div>

      <hr className="border-navy-border" />

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1">
          <Filter size={10} /> Filtros
        </p>

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

        {orderTypes.length > 0 && (
          <div>
            <label className="block text-slate-400 text-xs mb-1">Tipo de pedido</label>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
              {orderTypes.map((t) => (
                <label key={t.code} className="flex items-center gap-2 text-slate-300 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.selectedTypes.includes(t.code)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...filters.selectedTypes, t.code]
                        : filters.selectedTypes.filter((c) => c !== t.code);
                      onFiltersChange({ selectedTypes: next });
                    }}
                    className="accent-teal"
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {orderTypes.length === 0 && (
          <p className="text-slate-600 text-xs">Introduce tu API Key para cargar los tipos de pedido.</p>
        )}

        <div>
          <label className="block text-slate-400 text-xs mb-1">ID de asesor (opcional)</label>
          <input
            type="text"
            value={filters.managerId}
            onChange={(e) => onFiltersChange({ managerId: e.target.value })}
            placeholder="ej. 42"
            className="w-full bg-navy-border text-white text-sm rounded-md px-3 py-1.5 border border-navy-border focus:outline-none focus:ring-1 focus:ring-teal placeholder:text-slate-600"
          />
        </div>
      </div>

      <div className="mt-auto">
        <button
          onClick={onLoad}
          disabled={loading || !filters.apiKey}
          className="w-full bg-brand-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2 rounded-md transition-colors"
        >
          {loading ? "Cargando…" : "Cargar datos"}
        </button>
      </div>
    </aside>
  );
}
