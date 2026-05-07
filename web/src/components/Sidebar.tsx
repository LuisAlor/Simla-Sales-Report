import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  BarChart3, TrendingDown, LineChart,
  ChevronDown, ShieldCheck, LogOut,
  Clock, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import dayjs from "dayjs";

export type { Filters } from "@/lib/filters";

const COLLAPSED_KEY = "simla_sidebar_collapsed";
const EXPANDED_W = 224; // w-56
const COLLAPSED_W = 60;

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const [logoError, setLogoError] = useState(false);
  const [now, setNow] = useState(() => dayjs());
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === "1"
  );
  const [openModules, setOpenModules] = useState<Set<string>>(new Set(["analytics"]));
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Flyout
  const [flyout, setFlyout] = useState<{ moduleId: string; top: number } | null>(null);
  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openFlyout(e: React.MouseEvent<HTMLElement>, moduleId: string) {
    if (flyoutTimer.current) { clearTimeout(flyoutTimer.current); flyoutTimer.current = null; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFlyout({ moduleId, top: rect.top });
  }
  function closeFlyoutDelayed() {
    flyoutTimer.current = setTimeout(() => setFlyout(null), 120);
  }
  function cancelCloseFlyout() {
    if (flyoutTimer.current) { clearTimeout(flyoutTimer.current); flyoutTimer.current = null; }
  }

  useEffect(() => () => { if (flyoutTimer.current) clearTimeout(flyoutTimer.current); }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function toggleCollapsed() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    setFlyout(null);
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  }

  function toggleModule(id: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const MODULES = [
    {
      id: "analytics",
      label: t("nav_analytics"),
      icon: BarChart3,
      pages: [
        { to: "/",       label: t("nav_general"), icon: LineChart,    end: true  },
        { to: "/funnel", label: t("nav_funnel"),  icon: TrendingDown, end: false },
      ],
    },
  ];

  const adminLabel = t("sidebar_admin");

  const tz = Intl.DateTimeFormat("en", { timeZoneName: "shortOffset" })
    .formatToParts(now.toDate())
    .find((p) => p.type === "timeZoneName")?.value ?? "UTC";

  const isModuleActive = (m: (typeof MODULES)[0]) =>
    m.pages.some((p) => (p.end ? location.pathname === p.to : location.pathname.startsWith(p.to)));

  const iconBtn = (active: boolean) =>
    `flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
      active ? "bg-brand-blue text-white" : "text-slate-400 hover:bg-navy-border hover:text-white"
    }`;

  // Avatar with online dot
  function AvatarWithStatus({ size }: { size: number }) {
    const dotSize = Math.round(size * 0.32);
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <Avatar
          firstName={user!.firstName}
          lastName={user!.lastName}
          avatarDataUrl={user!.avatarDataUrl}
          size={size}
        />
        <span
          className={`absolute rounded-full border-2 border-navy ${isOnline ? "bg-green-400" : "bg-red-500"}`}
          style={{ width: dotSize, height: dotSize, bottom: 0, right: 0 }}
        />
      </div>
    );
  }

  // Floating toggle: small circle at the right edge of the sidebar header
  const toggleLeft = (isCollapsed ? COLLAPSED_W : EXPANDED_W) - 9;

  return (
    <>
      <aside
        className={`${
          isCollapsed ? "w-[60px]" : "w-56"
        } transition-all duration-200 ease-in-out h-screen sticky top-0 bg-navy flex flex-col shrink-0`}
      >
        {/* ── Brand ── */}
        <div className={`flex items-center border-b border-navy-border shrink-0 ${isCollapsed ? "justify-center px-2 py-3" : "gap-2 px-2 pt-2 pb-3"}`}>
          <button
            onClick={() => navigate("/")}
            className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0 hover:opacity-80 transition-opacity ${logoError ? "bg-teal" : ""}`}
          >
            {logoError ? (
              <span className="text-white font-bold text-base">S</span>
            ) : (
              <img src="/logo.png" alt="Simla.com" className="w-full h-full object-contain" onError={() => setLogoError(true)} />
            )}
          </button>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Simla.com</p>
              <p className="text-slate-500 text-[10px] tabular-nums flex items-center gap-1 whitespace-nowrap">
                <Clock size={9} className="shrink-0" />
                {now.format("DD/MM/YYYY HH:mm:ss")}
                <span>({tz})</span>
              </p>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className={`flex flex-col flex-1 pt-2 ${isCollapsed ? "items-center px-1 gap-1" : "px-1 gap-0.5"}`}>
          {isCollapsed ? (
            MODULES.map((module) => {
              const ModIcon = module.icon;
              return (
                <div key={module.id} onMouseEnter={(e) => openFlyout(e, module.id)} onMouseLeave={closeFlyoutDelayed}>
                  <button className={iconBtn(isModuleActive(module))}>
                    <ModIcon size={16} />
                  </button>
                </div>
              );
            })
          ) : (
            MODULES.map((module) => {
              const ModIcon = module.icon;
              const isOpen = openModules.has(module.id);
              return (
                <div key={module.id}>
                  <button
                    onClick={() => toggleModule(module.id)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-slate-400 hover:text-white hover:bg-navy-border transition-colors"
                  >
                    <ModIcon size={14} className="shrink-0" />
                    <span className="flex-1 text-left font-medium text-sm">{module.label}</span>
                    <ChevronDown size={12} className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-0.5 mb-1 border-l border-navy-border pl-3 flex flex-col gap-0.5">
                      {module.pages.map((page) => {
                        const PageIcon = page.icon;
                        return (
                          <NavLink
                            key={page.to}
                            to={page.to}
                            end={page.end}
                            className={({ isActive }) =>
                              `flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                                isActive
                                  ? "bg-brand-blue text-white font-semibold"
                                  : "text-slate-400 hover:bg-navy-border hover:text-white"
                              }`
                            }
                          >
                            <PageIcon size={12} className="shrink-0" />
                            {page.label}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        {/* ── Admin — always above profile ── */}
        {user?.role === "admin" && (
          <div className={`border-t border-navy-border ${isCollapsed ? "flex justify-center py-2 px-1" : "px-2 py-2"}`}>
            {isCollapsed ? (
              <div onMouseEnter={(e) => openFlyout(e, "admin")} onMouseLeave={closeFlyoutDelayed}>
                <button
                  onClick={() => navigate("/admin")}
                  className={iconBtn(location.pathname === "/admin")}
                >
                  <ShieldCheck size={16} />
                </button>
              </div>
            ) : (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-brand-blue text-white font-semibold"
                      : "text-slate-400 hover:text-white hover:bg-navy-border"
                  }`
                }
              >
                <ShieldCheck size={14} className="shrink-0" />
                <span className="font-medium">{adminLabel}</span>
              </NavLink>
            )}
          </div>
        )}

        {/* ── User / profile ── */}
        <div className={`border-t border-navy-border ${isCollapsed ? "flex justify-center py-3" : "pt-2 pb-2 px-2"}`}>
          {user && (
            isCollapsed ? (
              <button
                onClick={() => navigate("/profile")}
                title={`${user.firstName} ${user.lastName}`}
                className="hover:opacity-80 transition-opacity"
              >
                <AvatarWithStatus size={30} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 flex items-center gap-2 cursor-pointer hover:bg-navy-border rounded-md px-2 py-1.5 transition-colors min-w-0"
                  onClick={() => navigate("/profile")}
                >
                  <AvatarWithStatus size={26} />
                  <div className="min-w-0 overflow-hidden">
                    <p className="text-white text-xs font-semibold truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-slate-500 text-[10px] truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  title={t("sidebar_logout")}
                  className="text-slate-500 hover:text-red-400 transition-colors shrink-0 p-1.5 rounded hover:bg-navy-border"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )
          )}
        </div>
      </aside>

      {/* ── Floating collapse toggle ── */}
      <button
        onClick={toggleCollapsed}
        title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
        style={{
          position: "fixed",
          left: toggleLeft,
          top: 22,
          transition: "left 200ms ease-in-out",
          zIndex: 100,
          width: 18,
          height: 18,
        }}
        className="rounded-full bg-navy-border border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-400 shadow-md transition-colors"
      >
        {isCollapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
      </button>

      {/* ── Flyout portal (collapsed mode) — seamless, no gap, squared left edge ── */}
      {isCollapsed && flyout && createPortal(
        <div
          style={{
            position: "fixed",
            top: flyout.top,
            left: COLLAPSED_W,
            zIndex: 9999,
            minWidth: 168,
          }}
          onMouseEnter={cancelCloseFlyout}
          onMouseLeave={closeFlyoutDelayed}
          className="bg-navy border-t border-r border-b border-navy-border rounded-tr-lg rounded-br-lg shadow-xl overflow-hidden"
        >
          {/* Analytics submenu */}
          {MODULES.filter((m) => m.id === flyout.moduleId).map((module) => (
            <div key={module.id}>
              <p className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest border-b border-navy-border">
                {module.label}
              </p>
              {module.pages.map((page) => {
                const PageIcon = page.icon;
                const isActive = page.end
                  ? location.pathname === page.to
                  : location.pathname.startsWith(page.to);
                return (
                  <NavLink
                    key={page.to}
                    to={page.to}
                    end={page.end}
                    onClick={() => setFlyout(null)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isActive
                        ? "text-brand-blue font-semibold bg-brand-blue/10"
                        : "text-slate-300 hover:text-white hover:bg-navy-border"
                    }`}
                  >
                    <PageIcon size={14} className="shrink-0" />
                    {page.label}
                  </NavLink>
                );
              })}
            </div>
          ))}

          {/* Admin submenu */}
          {flyout.moduleId === "admin" && user?.role === "admin" && (
            <div>
              <p className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest border-b border-navy-border">
                {adminLabel}
              </p>
              <button
                onClick={() => { navigate("/admin"); setFlyout(null); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  location.pathname === "/admin"
                    ? "text-brand-blue font-semibold bg-brand-blue/10"
                    : "text-slate-300 hover:text-white hover:bg-navy-border"
                }`}
              >
                <ShieldCheck size={14} className="shrink-0" />
                {adminLabel}
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
