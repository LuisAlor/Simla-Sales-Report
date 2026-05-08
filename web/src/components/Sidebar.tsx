import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  BarChart3, TrendingDown, LineChart,
  Cog, GripVertical, RotateCcw, X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";

export type { Filters } from "@/lib/filters";

const W = 60;

// ── Nav order storage ─────────────────────────────────────────────────────────
const ALL_PAGES = [
  { to: "/",       labelKey: "nav_general", Icon: LineChart,    end: true  },
  { to: "/funnel", labelKey: "nav_funnel",  Icon: TrendingDown, end: false },
] as const;

type PageTo = (typeof ALL_PAGES)[number]["to"];

function navOrderKey(userId: string) { return `simla_nav_order_${userId}`; }

function loadNavOrder(userId: string): PageTo[] {
  try {
    const raw = localStorage.getItem(navOrderKey(userId));
    if (raw) {
      const stored = JSON.parse(raw) as string[];
      const valid = stored.filter((p): p is PageTo => ALL_PAGES.some((pg) => pg.to === p));
      const missing = ALL_PAGES.filter((pg) => !valid.includes(pg.to)).map((pg) => pg.to);
      return [...valid, ...missing] as PageTo[];
    }
  } catch { /* ignore */ }
  return ALL_PAGES.map((p) => p.to) as PageTo[];
}

function saveNavOrder(userId: string, order: PageTo[]) {
  try { localStorage.setItem(navOrderKey(userId), JSON.stringify(order)); } catch { /* ignore */ }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [logoError, setLogoError] = useState(false);

  const [navOrder, setNavOrder] = useState<PageTo[]>(() =>
    user ? loadNavOrder(user.id) : (ALL_PAGES.map((p) => p.to) as PageTo[])
  );

  const [showReorder, setShowReorder] = useState(false);
  const [reorderAnchorTop, setReorderAnchorTop] = useState(0);
  const reorderPanelRef = useRef<HTMLDivElement>(null);
  const reorderBtnRef = useRef<HTMLButtonElement>(null);
  const dragSrcRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  const [flyout, setFlyout] = useState<{ moduleId: string; top: number } | null>(null);
  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        reorderPanelRef.current && !reorderPanelRef.current.contains(e.target as Node) &&
        reorderBtnRef.current  && !reorderBtnRef.current.contains(e.target as Node)
      ) {
        setShowReorder(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => () => { if (flyoutTimer.current) clearTimeout(flyoutTimer.current); }, []);

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

  function updateNavOrder(next: PageTo[]) {
    setNavOrder(next);
    if (user) saveNavOrder(user.id, next);
  }

  function resetNavOrder() {
    updateNavOrder(ALL_PAGES.map((p) => p.to) as PageTo[]);
  }

  function clearDragNavStyles() {
    document.querySelectorAll("[data-nav-item]").forEach((el) => {
      el.classList.remove("bg-brand-blue/10", "outline", "outline-2", "outline-blue-400");
    });
  }

  function handleNavDragStart(e: React.DragEvent, idx: number) {
    dragSrcRef.current = idx;
    e.dataTransfer.effectAllowed = "move";
    requestAnimationFrame(() => {
      (e.target as HTMLElement).closest("[data-nav-item]")?.classList.add("opacity-40");
    });
  }

  function handleNavDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverRef.current === idx) return;
    dragOverRef.current = idx;
    document.querySelectorAll("[data-nav-item]").forEach((el) => {
      const elIdx = Number((el as HTMLElement).dataset.navItem);
      if (elIdx === idx && elIdx !== dragSrcRef.current) {
        el.classList.add("bg-brand-blue/10", "outline", "outline-2", "outline-blue-400");
      } else {
        el.classList.remove("bg-brand-blue/10", "outline", "outline-2", "outline-blue-400");
      }
    });
  }

  function handleNavDrop(idx: number) {
    clearDragNavStyles();
    const src = dragSrcRef.current;
    if (src !== null && src !== idx) {
      const next = [...navOrder];
      const [item] = next.splice(src, 1);
      next.splice(idx, 0, item);
      updateNavOrder(next);
    }
    dragSrcRef.current  = null;
    dragOverRef.current = null;
  }

  function handleNavDragEnd() {
    clearDragNavStyles();
    document.querySelectorAll("[data-nav-item]").forEach((el) => el.classList.remove("opacity-40"));
    dragSrcRef.current  = null;
    dragOverRef.current = null;
  }

  const orderedPages = navOrder
    .map((to) => ALL_PAGES.find((p) => p.to === to))
    .filter(Boolean) as typeof ALL_PAGES[number][];

  const iconBtn = (active: boolean) =>
    `flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
      active
        ? "!bg-brand-blue !text-white shadow-md"
        : "text-slate-400 hover:bg-navy-border hover:!text-white"
    }`;

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

  const isAnalyticsActive = orderedPages.some((p) =>
    p.end ? location.pathname === p.to : location.pathname.startsWith(p.to)
  );

  return (
    <>
      <aside
        style={{ width: W }}
        className="h-screen sticky top-0 bg-navy flex flex-col shrink-0"
      >
        {/* ── Logo ── */}
        <div className="flex justify-center items-center py-3 border-b border-navy-border">
          <button
            onClick={() => navigate("/")}
            title="Simla.com"
            className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity ${logoError ? "bg-teal" : ""}`}
          >
            {logoError ? (
              <span className="text-white font-bold text-base">S</span>
            ) : (
              <img src="/logo.png" alt="Simla.com" className="w-full h-full object-contain" onError={() => setLogoError(true)} />
            )}
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex flex-col flex-1 pt-3 items-center px-1 gap-1">
          <div onMouseEnter={(e) => openFlyout(e, "analytics")} onMouseLeave={closeFlyoutDelayed}>
            <button className={iconBtn(isAnalyticsActive)}>
              <BarChart3 size={16} />
            </button>
          </div>
        </nav>

        {/* ── Admin ── */}
        {user?.role === "admin" && (
          <div className="flex justify-center py-2 px-1 border-t border-navy-border">
            <div onMouseEnter={(e) => openFlyout(e, "admin")} onMouseLeave={closeFlyoutDelayed}>
              <button
                onClick={() => navigate("/admin")}
                className={iconBtn(location.pathname === "/admin")}
              >
                <Cog size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Profile ── */}
        <div className="flex justify-center py-3 border-t border-navy-border">
          {user && (
            <button
              onClick={() => navigate("/profile")}
              title={`${user.firstName} ${user.lastName}`}
              className="hover:opacity-80 transition-opacity"
            >
              <AvatarWithStatus size={30} />
            </button>
          )}
        </div>
      </aside>

      {/* ── Nav reorder panel (portal, anchored below flyout) ── */}
      {showReorder && createPortal(
        <div
          ref={reorderPanelRef}
          style={{ position: "fixed", left: W, top: reorderAnchorTop, zIndex: 10000, minWidth: 200 }}
          onMouseEnter={cancelCloseFlyout}
          onMouseLeave={closeFlyoutDelayed}
          className="bg-navy border border-navy-border rounded-tr-lg rounded-br-lg shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-navy-border">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              {t("nav_reorder_title")}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={resetNavOrder}
                title={t("nav_reorder_reset")}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-brand-blue transition-colors"
              >
                <RotateCcw size={9} /> {t("nav_reorder_reset")}
              </button>
              <button onClick={() => setShowReorder(false)} className="text-slate-500 hover:text-slate-200 transition-colors">
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="p-2 flex flex-col gap-0.5">
            {orderedPages.map((page, idx) => {
              const PageIcon = page.Icon;
              const label = t(page.labelKey as Parameters<typeof t>[0]);
              return (
                <div
                  key={page.to}
                  data-nav-item={idx}
                  draggable
                  onDragStart={(e) => handleNavDragStart(e, idx)}
                  onDragOver={(e) => handleNavDragOver(e, idx)}
                  onDrop={() => handleNavDrop(idx)}
                  onDragEnd={handleNavDragEnd}
                  className="flex items-center gap-2 px-2 py-2 rounded-md text-slate-300 hover:bg-navy-border transition-colors cursor-grab active:cursor-grabbing select-none"
                >
                  <GripVertical size={11} className="text-slate-600 shrink-0" />
                  <PageIcon size={13} className="shrink-0 text-slate-400" />
                  <span className="text-xs">{label}</span>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}

      {/* ── Flyout portal ── */}
      {flyout && createPortal(
        <div
          style={{ position: "fixed", top: flyout.top, left: W, zIndex: 9999, minWidth: 168 }}
          onMouseEnter={cancelCloseFlyout}
          onMouseLeave={closeFlyoutDelayed}
          className="bg-navy border-t border-r border-b border-navy-border rounded-tr-lg rounded-br-lg shadow-xl overflow-hidden"
        >
          {flyout.moduleId === "analytics" && (
            <div>
              <p className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest border-b border-navy-border">
                {t("nav_analytics")}
              </p>
              {orderedPages.map((page) => {
                const PageIcon = page.Icon;
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
                    {t(page.labelKey as Parameters<typeof t>[0])}
                  </NavLink>
                );
              })}
              {/* Reorder trigger at the bottom of the flyout */}
              <div className="border-t border-navy-border">
                <button
                  ref={reorderBtnRef}
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setReorderAnchorTop(rect.top);
                    setShowReorder((v) => !v);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-xs transition-colors ${
                    showReorder
                      ? "text-brand-blue bg-brand-blue/10"
                      : "text-slate-500 hover:text-slate-300 hover:bg-navy-border"
                  }`}
                >
                  <GripVertical size={12} className="shrink-0" />
                  {t("nav_reorder_title")}
                </button>
              </div>
            </div>
          )}

          {flyout.moduleId === "admin" && user?.role === "admin" && (
            <div>
              <p className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest border-b border-navy-border">
                {t("sidebar_admin")}
              </p>
              <button
                onClick={() => { navigate("/admin"); setFlyout(null); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  location.pathname === "/admin"
                    ? "text-brand-blue font-semibold bg-brand-blue/10"
                    : "text-slate-300 hover:text-white hover:bg-navy-border"
                }`}
              >
                <Cog size={14} className="shrink-0" />
                {t("sidebar_admin")}
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
