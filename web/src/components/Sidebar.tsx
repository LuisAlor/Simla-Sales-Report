import { useState, useEffect } from "react";
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

// Re-export Filters type so existing imports keep working
export type { Filters } from "@/lib/filters";

const COLLAPSED_KEY = "simla_sidebar_collapsed";

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

  useEffect(() => {
    const id = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(id);
  }, []);

  function toggleCollapsed() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
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

  const initialOpen = () => {
    const open = new Set<string>();
    for (const m of MODULES) {
      if (m.pages.some((p) => p.end ? location.pathname === p.to : location.pathname.startsWith(p.to))) {
        open.add(m.id);
      }
    }
    if (open.size === 0) open.add(MODULES[0].id);
    return open;
  };

  const [openModules, setOpenModules] = useState<Set<string>>(initialOpen);

  function toggleModule(id: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const iconNavCls = (isActive: boolean) =>
    `flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
      isActive
        ? "bg-brand-blue text-white"
        : "text-slate-400 hover:bg-navy-border hover:text-white"
    }`;

  const tz = Intl.DateTimeFormat("en", { timeZoneName: "shortOffset" })
    .formatToParts(now.toDate())
    .find((p) => p.type === "timeZoneName")?.value ?? "UTC";

  return (
    <aside
      className={`${isCollapsed ? "w-[60px]" : "w-64"} transition-all duration-200 ease-in-out h-screen sticky top-0 overflow-y-auto bg-navy flex flex-col shrink-0`}
    >
      {/* ── Brand ── */}
      <div className={`flex items-center border-b border-navy-border shrink-0 ${isCollapsed ? "justify-center px-2 py-3" : "gap-2.5 px-3 pt-2 pb-3"}`}>
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0 ${logoError ? "bg-teal" : ""}`}
        >
          {logoError ? (
            <span className="text-white font-bold text-base">S</span>
          ) : (
            <img
              src="/logo.png"
              alt="Simla.com"
              className="w-full h-full object-contain"
              onError={() => setLogoError(true)}
            />
          )}
        </div>

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
      {isCollapsed ? (
        /* Collapsed: flat icon list */
        <nav className="flex flex-col items-center gap-1 flex-1 pt-3 px-1">
          {MODULES.flatMap((m) =>
            m.pages.map((page) => {
              const PageIcon = page.icon;
              return (
                <NavLink
                  key={page.to}
                  to={page.to}
                  end={page.end}
                  title={page.label}
                  className={({ isActive }) => iconNavCls(isActive)}
                >
                  <PageIcon size={16} />
                </NavLink>
              );
            })
          )}
        </nav>
      ) : (
        /* Expanded: accordion */
        <nav className="flex flex-col gap-0.5 flex-1 pt-2 px-1">
          {MODULES.map((module) => {
            const ModIcon = module.icon;
            const isOpen = openModules.has(module.id);
            return (
              <div key={module.id}>
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-slate-400 hover:text-white hover:bg-navy-border transition-colors text-sm"
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
          })}
        </nav>
      )}

      {/* ── Admin ── */}
      {user?.role === "admin" && (
        <div className={`flex border-t border-navy-border py-2 ${isCollapsed ? "justify-center px-1" : "px-3"}`}>
          {isCollapsed ? (
            <button
              onClick={() => navigate("/admin")}
              title={t("sidebar_admin")}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-navy-border transition-colors"
            >
              <ShieldCheck size={16} />
            </button>
          ) : (
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-navy-border transition-colors text-xs"
            >
              <ShieldCheck size={13} />
              <span>{t("sidebar_admin")}</span>
            </button>
          )}
        </div>
      )}

      {/* ── Collapse toggle ── */}
      <div className={`flex border-t border-navy-border py-2 ${isCollapsed ? "justify-center px-1" : "justify-end px-3"}`}>
        <button
          onClick={toggleCollapsed}
          title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
          className="flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:text-white hover:bg-navy-border transition-colors"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* ── User / profile ── */}
      <div className={`border-t border-navy-border ${isCollapsed ? "flex justify-center py-3 px-1" : "pt-2 px-2 pb-2"}`}>
        {user && (
          isCollapsed ? (
            <button
              onClick={() => navigate("/profile")}
              title={`${user.firstName} ${user.lastName}`}
              className="flex items-center justify-center rounded-full hover:opacity-80 transition-opacity"
            >
              <Avatar firstName={user.firstName} lastName={user.lastName} avatarDataUrl={user.avatarDataUrl} size={30} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="flex-1 flex items-center gap-2 cursor-pointer hover:bg-navy-border rounded-md px-2 py-1.5 transition-colors min-w-0"
                onClick={() => navigate("/profile")}
              >
                <Avatar firstName={user.firstName} lastName={user.lastName} avatarDataUrl={user.avatarDataUrl} size={26} />
                <div className="overflow-hidden">
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
  );
}
