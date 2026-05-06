import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface Props {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
  compact?: boolean;
}

type Mode = "calendar" | "relative";
type Selecting = "from" | "to";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const PRESETS_BACK = [
  ["1 año", 365], ["6 meses", 180], ["3 meses", 90], ["2 meses", 60],
  ["1 mes", 30], ["3 semanas", 21], ["2 semanas", 14],
  ["1 semana", 7], ["6 días", 6], ["5 días", 5], ["4 días", 4],
  ["3 días", 3], ["2 días", 2], ["1 día", 1],
] as [string, number][];

function fmt(d: string) {
  return d ? dayjs(d).format("DD/MM/YYYY") : "—";
}

export function DateRangePicker({ dateFrom, dateTo, onChange, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("calendar");
  const [selecting, setSelecting] = useState<Selecting>("from");
  const [hovered, setHovered] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => dayjs(dateFrom || undefined));
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setHovered(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function openFor(which: Selecting) {
    setSelecting(which);
    setMode("calendar");
    setViewMonth(dayjs(which === "from" ? (dateFrom || undefined) : (dateTo || undefined)));
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popupW = 288;
      const left = rect.right + 8 + popupW > window.innerWidth
        ? rect.left - popupW - 8
        : rect.right + 8;
      const top = Math.min(rect.top, window.innerHeight - 420);
      setPopupPos({ top, left });
    }
    setOpen(true);
  }

  function handleDayClick(ds: string) {
    if (selecting === "from") {
      const newTo = dateTo < ds ? ds : dateTo;
      onChange(ds, newTo);
      setSelecting("to");
    } else {
      if (ds < dateFrom) {
        onChange(ds, dateFrom);
      } else {
        onChange(dateFrom, ds);
      }
      setOpen(false);
      setHovered(null);
    }
  }

  function applyPreset(days: number) {
    onChange(
      dayjs().subtract(days, "day").format("YYYY-MM-DD"),
      dayjs().format("YYYY-MM-DD")
    );
    setOpen(false);
  }

  function applyToday() {
    const today = dayjs().format("YYYY-MM-DD");
    onChange(today, today);
    setOpen(false);
  }

  function reset() {
    onChange(
      dayjs().subtract(30, "day").format("YYYY-MM-DD"),
      dayjs().format("YYYY-MM-DD")
    );
  }

  // Calendar grid
  const firstDay = viewMonth.startOf("month");
  const startOffset = (firstDay.day() + 6) % 7; // Mon=0
  const daysInMonth = viewMonth.daysInMonth();
  const cells: (string | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      viewMonth.date(i + 1).format("YYYY-MM-DD")
    ),
  ];

  const today = dayjs().format("YYYY-MM-DD");
  const effectiveTo = selecting === "to" && open && hovered ? hovered : dateTo;
  const [rangeStart, rangeEnd] =
    dateFrom <= effectiveTo ? [dateFrom, effectiveTo] : [effectiveTo, dateFrom];

  function cellClass(ds: string) {
    const isFuture = ds > today;
    if (ds === rangeStart || ds === rangeEnd) {
      return isFuture
        ? "opacity-30 cursor-default"
        : "bg-[#1e3a5f] text-white rounded-full font-semibold";
    }
    if (ds > rangeStart && ds < rangeEnd) {
      return isFuture ? "opacity-30 cursor-default" : "bg-blue-100 text-slate-700";
    }
    if (ds === today) return "text-teal font-bold hover:bg-slate-100 rounded-full";
    if (isFuture) return "text-slate-300 cursor-default";
    return "text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer";
  }

  const currentYear = dayjs().year();
  const years = Array.from({ length: 8 }, (_, i) => currentYear - 6 + i);

  const popup = open ? (
    <div
      ref={popupRef}
      style={{ position: "fixed", top: popupPos.top, left: popupPos.left, zIndex: 9999 }}
      className="bg-white border border-slate-200 rounded-xl shadow-xl w-72 text-slate-800"
    >
      {mode === "calendar" ? (
        <div className="p-3">
          <p className="text-center text-[10px] text-slate-400 mb-2 font-semibold uppercase tracking-wide">
            {selecting === "from" ? "Selecciona fecha inicial" : "Selecciona fecha final"}
          </p>

          {/* Month/year navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setViewMonth((m) => m.subtract(1, "month"))}
              className="p-1 hover:bg-slate-100 rounded text-slate-500"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="flex gap-1 text-sm font-semibold text-slate-700">
              <select
                value={viewMonth.month()}
                onChange={(e) => setViewMonth((m) => m.month(Number(e.target.value)))}
                className="outline-none bg-transparent cursor-pointer"
              >
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select
                value={viewMonth.year()}
                onChange={(e) => setViewMonth((m) => m.year(Number(e.target.value)))}
                className="outline-none bg-transparent cursor-pointer"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button
              onClick={() => setViewMonth((m) => m.add(1, "month"))}
              className="p-1 hover:bg-slate-100 rounded text-slate-500"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 text-center mb-1">
            {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d) => (
              <div key={d} className="text-[9px] text-slate-400 font-semibold">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 text-center gap-y-0.5">
            {cells.map((ds, i) => (
              <div key={i} className="flex items-center justify-center">
                {ds ? (
                  <button
                    disabled={ds > today}
                    className={`w-7 h-7 text-xs flex items-center justify-center transition-colors ${cellClass(ds)}`}
                    onClick={() => ds <= today && handleDayClick(ds)}
                    onMouseEnter={() => setHovered(ds)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {parseInt(ds.slice(8))}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
            <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600">
              × Reiniciar
            </button>
            <button onClick={() => setMode("relative")} className="text-xs text-blue-600 hover:underline">
              Fechas relativas
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-[10px] font-bold text-slate-400 tracking-widest mb-2">ATRÁS:</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
            {PRESETS_BACK.map(([label, days]) => (
              <button
                key={label}
                onClick={() => applyPreset(days)}
                className="text-blue-600 text-sm hover:underline"
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={applyToday} className="text-blue-600 text-sm hover:underline block mb-1">
            Hoy
          </button>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
            <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600">
              × Reiniciar
            </button>
            <button onClick={() => setMode("calendar")} className="text-xs text-blue-600 hover:underline">
              Calendario
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  if (compact) {
    return (
      <>
        <div ref={triggerRef}>
          <button
            onClick={() => openFor("from")}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors whitespace-nowrap ${
              open
                ? "border-brand-blue text-slate-700 dark:text-slate-200 bg-blue-50 dark:bg-blue-900/20"
                : "border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
            }`}
          >
            <Calendar size={11} className="text-slate-400 shrink-0" />
            {fmt(dateFrom)} → {fmt(dateTo)}
          </button>
        </div>
        {createPortal(popup, document.body)}
      </>
    );
  }

  return (
    <>
      <div ref={triggerRef} className="flex gap-2">
        <div className="flex-1">
          <label className="block text-slate-400 text-xs mb-1">Desde</label>
          <button
            onClick={() => openFor("from")}
            className={`w-full bg-navy-border text-left text-xs rounded-md px-2 py-1.5 border transition-colors flex items-center justify-between ${
              open && selecting === "from" ? "border-teal text-white" : "border-navy-border text-slate-300"
            }`}
          >
            {fmt(dateFrom)}
            <Calendar size={11} className="text-slate-500 shrink-0" />
          </button>
        </div>
        <div className="flex-1">
          <label className="block text-slate-400 text-xs mb-1">Hasta</label>
          <button
            onClick={() => openFor("to")}
            className={`w-full bg-navy-border text-left text-xs rounded-md px-2 py-1.5 border transition-colors flex items-center justify-between ${
              open && selecting === "to" ? "border-teal text-white" : "border-navy-border text-slate-300"
            }`}
          >
            {fmt(dateTo)}
            <Calendar size={11} className="text-slate-500 shrink-0" />
          </button>
        </div>
      </div>
      {createPortal(popup, document.body)}
    </>
  );
}
