import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Layout } from "@/components/Layout";
import { Analytics } from "@/pages/Analytics";
import { Funnel } from "@/pages/Funnel";
import { Login } from "@/pages/Login";
import { AdminPanel } from "@/pages/AdminPanel";
import { Profile } from "@/pages/Profile";
import { ApiSetup } from "@/pages/ApiSetup";
import { TLDV } from "@/pages/TLDV";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { fetchOrders, fetchStatuses, fetchDictionaryOptions } from "@/lib/api";
import { flattenAll } from "@/lib/flatten";
import { makeKey, readCache, writeCache, clearCache } from "@/lib/ordersCache";
import { notifyDone } from "@/lib/notify";
import { useT } from "@/contexts/I18nContext";
import type { Filters } from "@/lib/filters";
import type { OrderRecord, ItemRecord } from "@/lib/flatten";
import type { FilterTemplate } from "@/lib/auth";
import { getUsers } from "@/lib/auth";

function getDefaultFilters(savedFilters?: Record<string, unknown>): Filters {
  return {
    dateFrom: (savedFilters?.dateFrom as string) ?? dayjs().subtract(30, "day").format("YYYY-MM-DD"),
    dateTo:   (savedFilters?.dateTo   as string) ?? dayjs().format("YYYY-MM-DD"),
    freq:     (savedFilters?.freq as Filters["freq"]) ?? "D",
    selectedTypes: (savedFilters?.selectedTypes as string[]) ?? ["crm-license"],
    managerIds: (savedFilters?.managerIds as string[]) ?? [],
    utmSources: (savedFilters?.utmSources as string[]) ?? [],
    utmMediums: (savedFilters?.utmMediums as string[]) ?? [],
    firstPaymentFrom: (savedFilters?.firstPaymentFrom as string) ?? "",
    firstPaymentTo:   (savedFilters?.firstPaymentTo   as string) ?? "",
  };
}

interface LoadedData {
  records: OrderRecord[];
  items: ItemRecord[];
}

function AppInner() {
  const { user, updateUser } = useAuth();
  const t = useT();
  const hasStoredApiKey = !!user?.apiKey;
  const apiKey = (user?.apiKeyEnabled !== false && user?.apiKey) ? user.apiKey : "";

  const [filters, setFilters] = useState<Filters>(() =>
    getDefaultFilters(user?.savedFilters)
  );
  const [loadKey, setLoadKey] = useState(1);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const queryClient = useQueryClient();

  // Auto-save filters to user profile on every change so state survives page reloads
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => {
    const u = userRef.current;
    if (!u) return;
    updateUser({ ...u, savedFilters: filters as unknown as Record<string, unknown> });
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFiltersChange = useCallback((partial: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleReset = useCallback(() => {
    setFilters(getDefaultFilters());
  }, []);

  // Auto-load statuses when API key available
  const { data: statuses = [] } = useQuery({
    queryKey: ["statuses", apiKey],
    queryFn: () => fetchStatuses(apiKey),
    enabled: apiKey.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  const statusLabels = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of statuses) map[s.code] = s.name;
    return map;
  }, [statuses]);

  // Resolve manager_sd codes → display names via the custom-fields dictionary
  const { data: managerSdMap = {} } = useQuery({
    queryKey: ["dictionary", "manager_sd", apiKey],
    queryFn: () => fetchDictionaryOptions(apiKey, "manager_sd"),
    enabled: apiKey.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  const [cachedAt, setCachedAt] = useState<number | null>(null);

  // Main data query — triggered by loadKey
  const { data, isFetching, error } = useQuery<LoadedData>({
    queryKey: ["orders", loadKey],
    queryFn: async () => {
      const cacheKey = makeKey(apiKey, filters.dateFrom, filters.dateTo, filters.selectedTypes, filters.firstPaymentFrom, filters.firstPaymentTo);

      // Return cached data instantly if available (skip all network requests)
      const cached = readCache(cacheKey);
      if (cached) {
        setCachedAt(cached.cachedAt);
        return { records: cached.records, items: cached.items };
      }

      setCachedAt(null);
      const typesToFetch = filters.selectedTypes.length > 0
        ? filters.selectedTypes
        : [undefined as string | undefined];

      // Fetch all order types in parallel, aggregating progress across all
      const progressMap = new Map<number, { done: number; total: number }>();
      const results = await Promise.all(
        typesToFetch.map((otype, idx) =>
          fetchOrders({
            apiKey,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
            firstPaymentFrom: filters.firstPaymentFrom || undefined,
            firstPaymentTo: filters.firstPaymentTo || undefined,
            orderType: otype,
            onProgress: (done, total) => {
              progressMap.set(idx, { done, total });
              const vals = [...progressMap.values()];
              setProgress({
                done: vals.reduce((s, p) => s + p.done, 0),
                total: vals.reduce((s, p) => s + p.total, 0),
              });
            },
          })
        )
      );

      const allOrders = results.flat();

      // Flash 100% so the ring visually completes before disappearing
      setProgress({ done: 1, total: 1 });
      await new Promise<void>((r) => setTimeout(r, 500));
      setProgress(null);

      const result = flattenAll(allOrders);
      writeCache(cacheKey, result);
      return result;
    },
    enabled: loadKey > 0 && apiKey.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  const wasFetchingRef = useRef(false);
  useEffect(() => {
    if (isFetching) {
      wasFetchingRef.current = true;
    } else if (wasFetchingRef.current) {
      wasFetchingRef.current = false;
      notifyDone(t("notify_done_title"), t("notify_done_body"));
    }
  }, [isFetching]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoad = useCallback(() => {
    if (!apiKey) return;
    // Clear cache for current filters so user always gets fresh data on explicit reload
    const cacheKey = makeKey(apiKey, filters.dateFrom, filters.dateTo, filters.selectedTypes, filters.firstPaymentFrom, filters.firstPaymentTo);
    clearCache(cacheKey);
    setCachedAt(null);
    queryClient.removeQueries({ queryKey: ["orders"] });
    setProgress(null);
    setLoadKey((k) => k + 1);
    if (user) {
      updateUser({
        ...user,
        savedFilters: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          freq: filters.freq,
          selectedTypes: filters.selectedTypes,
          managerIds: filters.managerIds,
          utmSources: filters.utmSources,
          utmMediums: filters.utmMediums,
          firstPaymentFrom: filters.firstPaymentFrom,
          firstPaymentTo: filters.firstPaymentTo,
        },
      });
    }
  }, [filters, apiKey, queryClient, user, updateUser]);

  const rawRecords = data?.records ?? [];
  const items = data?.items ?? [];

  // Resolve managerSd codes to display names using the custom field definition
  const allRecords = useMemo(() => {
    if (Object.keys(managerSdMap).length === 0) return rawRecords;
    return rawRecords.map((r) => ({
      ...r,
      managerSd: r.managerSd ? (managerSdMap[r.managerSd] ?? r.managerSd) : null,
    }));
  }, [rawRecords, managerSdMap]);

  // Build manager list from resolved managerSd display names
  const managerOptions = useMemo((): { value: string; label: string }[] => {
    const names = [...new Set(allRecords.map((r) => r.managerSd).filter(Boolean))] as string[];
    return names.sort().map((n) => ({ value: n, label: n }));
  }, [allRecords]);

  // Extract available UTMs from loaded orders; fall back to saved UTMs
  const availableUtms = useMemo(() => {
    const fromOrders = {
      sources: [...new Set(allRecords.map((r) => r.utmSource).filter(Boolean))] as string[],
      mediums: [...new Set(allRecords.map((r) => r.utmMedium).filter(Boolean))] as string[],
    };
    if (user && (fromOrders.sources.length > 0 || fromOrders.mediums.length > 0)) {
      const merged = {
        sources: [...new Set([...(user.savedUtms?.sources ?? []), ...fromOrders.sources])],
        mediums: [...new Set([...(user.savedUtms?.mediums ?? []), ...fromOrders.mediums])],
      };
      if (
        merged.sources.length !== (user.savedUtms?.sources?.length ?? 0) ||
        merged.mediums.length !== (user.savedUtms?.mediums?.length ?? 0)
      ) {
        updateUser({ ...user, savedUtms: merged });
      }
      return merged;
    }
    return user?.savedUtms ?? { sources: [], mediums: [] };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRecords]);

  // Apply client-side manager + UTM filters
  const records = useMemo(() => {
    let result = allRecords;
    if (filters.managerIds.length > 0) {
      result = result.filter((r) => r.managerSd && filters.managerIds.includes(r.managerSd));
    }
    if (filters.utmSources.length > 0) {
      result = result.filter((r) => r.utmSource && filters.utmSources.includes(r.utmSource));
    }
    if (filters.utmMediums.length > 0) {
      result = result.filter((r) => r.utmMedium && filters.utmMediums.includes(r.utmMedium));
    }
    return result;
  }, [allRecords, filters.managerIds, filters.utmSources, filters.utmMediums]);

  // Filter template handlers — own templates + other users' public ones
  const ownTemplates = user?.savedFilterTemplates ?? [];
  const filterTemplates = useMemo(() => {
    if (!user) return ownTemplates;
    const others = getUsers()
      .filter((u) => u.id !== user.id)
      .flatMap((u) => (u.savedFilterTemplates ?? []).filter((t) => t.visibility === "public"));
    return [...ownTemplates, ...others];
  }, [ownTemplates, user]);

  const handleSaveTemplate = useCallback((name: string, visibility: "private" | "public") => {
    if (!user) return;
    const newTemplate: FilterTemplate = {
      id: Date.now().toString(),
      name,
      ownerId: user.id,
      visibility,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      freq: filters.freq,
      selectedTypes: filters.selectedTypes,
      managerIds: filters.managerIds,
      utmSources: filters.utmSources,
      utmMediums: filters.utmMediums,
    };
    updateUser({ ...user, savedFilterTemplates: [...ownTemplates, newTemplate] });
  }, [user, filters, ownTemplates, updateUser]);

  const handleApplyTemplate = useCallback((t: FilterTemplate) => {
    setFilters({
      dateFrom: t.dateFrom,
      dateTo: t.dateTo,
      freq: t.freq as Filters["freq"],
      selectedTypes: t.selectedTypes,
      managerIds: t.managerIds,
      utmSources: t.utmSources,
      utmMediums: t.utmMediums,
      firstPaymentFrom: "",
      firstPaymentTo: "",
    });
  }, []);

  const handleDeleteTemplate = useCallback((id: string) => {
    if (!user) return;
    updateUser({ ...user, savedFilterTemplates: ownTemplates.filter((t) => t.id !== id) });
  }, [user, ownTemplates, updateUser]);

  const handleReorderTemplates = useCallback((reordered: FilterTemplate[]) => {
    if (!user) return;
    // only own templates are stored; reordered may include others' public ones — strip them
    const reorderedOwn = reordered.filter((t) => !t.ownerId || t.ownerId === user.id);
    updateUser({ ...user, savedFilterTemplates: reorderedOwn });
  }, [user, updateUser]);

  const handleRenameTemplate = useCallback((id: string, name: string) => {
    if (!user) return;
    updateUser({
      ...user,
      savedFilterTemplates: ownTemplates.map((t) => t.id === id ? { ...t, name } : t),
    });
  }, [user, ownTemplates, updateUser]);

  const layoutProps = {
    filters,
    managers: managerOptions,
    availableUtms,
    filterTemplates,
    onFiltersChange: handleFiltersChange,
    onLoad: handleLoad,
    onReset: handleReset,
    onSaveTemplate: handleSaveTemplate,
    onApplyTemplate: handleApplyTemplate,
    onDeleteTemplate: handleDeleteTemplate,
    onReorderTemplates: handleReorderTemplates,
    onRenameTemplate: handleRenameTemplate,
    loading: isFetching,
    cachedAt,
    hasApiKey: apiKey.length > 0,
  };

  if (!hasStoredApiKey) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<ProtectedRoute><ApiSetup /></ProtectedRoute>} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout {...layoutProps} />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <PageShell loading={isFetching} progress={progress} error={error} hasData={records.length > 0} loaded={loadKey > 0}>
              <Analytics records={records} items={items} freq={filters.freq} statusLabels={statusLabels} />
            </PageShell>
          }
        />
        <Route
          path="/funnel"
          element={
            <PageShell loading={isFetching} progress={progress} error={error} hasData={records.length > 0} loaded={loadKey > 0}>
              <Funnel records={records} freq={filters.freq} statusLabels={statusLabels} />
            </PageShell>
          }
        />
        <Route path="/tldv" element={<TLDV managerSdMap={managerSdMap} />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

interface ShellProps {
  loading: boolean;
  progress: { done: number; total: number } | null;
  error: Error | null;
  hasData: boolean;
  loaded: boolean;
  children: React.ReactNode;
}

function PageShell({ loading, progress, error, hasData, loaded, children }: ShellProps) {
  if (loading) return <LoadingScreen progress={progress} />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg p-4 text-sm">
        <strong>Error de API:</strong> {(error as Error).message}
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg p-4 text-sm">
        Selecciona los filtros en el panel lateral y pulsa <strong>Cargar datos</strong>.
      </div>
    );
  }

  if (!hasData) {
    return <EmptyState />;
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Empty state — shown when filters return zero orders
// ---------------------------------------------------------------------------

const EMPTY_BARS = [0.35, 0.55, 0.25, 0.45, 0.30, 0.50, 0.20, 0.40];

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 select-none">
      {/* Animated chart with zero-data bars */}
      <div className="relative">
        {/* Ghost chart frame */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-700 px-8 py-6 w-72">
          {/* Dashed grid lines */}
          <div className="absolute inset-x-8 top-6 bottom-10 pointer-events-none">
            {[0.33, 0.66].map((t) => (
              <div
                key={t}
                className="absolute left-0 right-0 border-t border-dashed border-slate-100 dark:border-gray-700"
                style={{ bottom: `${t * 100}%` }}
              />
            ))}
          </div>

          {/* Bars — all very short, breathing animation */}
          <div className="flex items-end gap-2 h-24">
            {EMPTY_BARS.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-slate-100 dark:bg-gray-700"
                style={{
                  height: `${h * 30}%`,
                  animation: `emptyPulse 2s ease-in-out ${i * 150}ms infinite`,
                }}
              />
            ))}
          </div>

          {/* X-axis line */}
          <div className="h-px bg-slate-100 dark:bg-gray-700 mt-1" />

          {/* Floating magnifying glass badge */}
          <div
            className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-md border border-slate-100 dark:border-gray-700 flex items-center justify-center"
            style={{ animation: "floatBadge 3s ease-in-out infinite" }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="22" y2="22" />
              <line x1="8" y1="11" x2="14" y2="11" strokeOpacity="0.4" />
              <line x1="11" y1="8" x2="11" y2="14" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="text-center">
        <p className="text-slate-700 dark:text-slate-200 font-semibold text-base">Sin resultados</p>
        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1 max-w-xs">
          No hay pedidos para los filtros activos. Intenta ampliar el rango de fechas o ajustar los filtros.
        </p>
      </div>

      <style>{`
        @keyframes emptyPulse {
          0%, 100% { opacity: 0.5; transform: scaleY(1); }
          50% { opacity: 1; transform: scaleY(1.3); }
        }
        @keyframes floatBadge {
          0%, 100% { transform: translateX(-50%) translateY(0px); }
          50% { transform: translateX(-50%) translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
