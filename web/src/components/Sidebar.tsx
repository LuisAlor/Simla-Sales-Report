import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  BarChart3, TrendingDown, LineChart,
  ChevronDown, ShieldCheck, LogOut,
  Sun, Moon, Monitor,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type Theme } from "@/contexts/ThemeContext";

const THEME_OPTS: { value: Theme; icon: React.ElementType; title: string }[] = [
  { value: "light", icon: Sun,     title: "Modo claro"     },
  { value: "auto",  icon: Monitor, title: "Modo automático" },
  { value: "dark",  icon: Moon,    title: "Modo oscuro"    },
];

// Re-export Filters type so existing imports keep working
export type { Filters } from "@/lib/filters";

// ---------------------------------------------------------------------------
// Module / page definitions — add future modules here
// ---------------------------------------------------------------------------

interface PageDef {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
}

interface ModuleDef {
  id: string;
  label: string;
  icon: React.ElementType;
  pages: PageDef[];
}

const MODULES: ModuleDef[] = [
  {
    id: "analytics",
    label: "Analíticas",
    icon: BarChart3,
    pages: [
      { to: "/",       label: "Generales", icon: LineChart,    end: true  },
      { to: "/funnel", label: "Embudo",    icon: TrendingDown, end: false },
    ],
  },
  // Future modules:
  // { id: "demo", label: "Demo Analysis", icon: Presentation, pages: [...] },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  // Auto-open the module whose page is currently active
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

  return (
    <aside className="w-52 h-screen sticky top-0 overflow-y-auto bg-navy flex flex-col p-3 gap-2 shrink-0">

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pt-1 pb-3 border-b border-navy-border">
        <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center text-white font-bold text-base shrink-0">
          S
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">Simla</p>
          <p className="text-slate-500 text-[10px]">Analytics · CRM</p>
        </div>
        {user?.role === "admin" && (
          <button
            onClick={() => navigate("/admin")}
            title="Administración"
            className="text-slate-500 hover:text-white transition-colors shrink-0"
          >
            <ShieldCheck size={14} />
          </button>
        )}
      </div>

      {/* Module navigation */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {MODULES.map((module) => {
          const ModIcon = module.icon;
          const isOpen = openModules.has(module.id);

          return (
            <div key={module.id}>
              {/* Module header — clickable to expand/collapse */}
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-slate-400 hover:text-white hover:bg-navy-border transition-colors text-sm"
              >
                <ModIcon size={14} className="shrink-0" />
                <span className="flex-1 text-left font-medium text-sm">{module.label}</span>
                <ChevronDown
                  size={12}
                  className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Sub-pages */}
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

      {/* Theme toggle */}
      <div className="flex items-center justify-center gap-1 py-2 border-t border-navy-border">
        {THEME_OPTS.map(({ value, icon: Icon, title }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            title={title}
            className={`p-1.5 rounded-md transition-colors ${
              theme === value
                ? "bg-teal text-white"
                : "text-slate-500 hover:text-slate-300 hover:bg-navy-border"
            }`}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>

      {/* User profile + logout */}
      <div className="pt-2 border-t border-navy-border">
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
                size={26}
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
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
