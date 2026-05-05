import { useState, useCallback, useMemo } from "react";
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
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { fetchOrders, fetchUsers, fetchStatuses } from "@/lib/api";
import { flattenAll } from "@/lib/flatten";
import type { Filters } from "@/components/Sidebar";
import type { OrderRecord, ItemRecord } from "@/lib/flatten";

function getDefaultFilters(savedFilters?: Record<string, unknown>): Filters {
  return {
    dateFrom: (savedFilters?.dateFrom as string) ?? dayjs().subtract(30, "day").format("YYYY-MM-DD"),
    dateTo:   (savedFilters?.dateTo   as string) ?? dayjs().format("YYYY-MM-DD"),
    freq:     (savedFilters?.freq as Filters["freq"]) ?? "D",
    selectedTypes: (savedFilters?.selectedTypes as string[]) ?? ["crm-license"],
    managerIds: (savedFilters?.managerIds as string[]) ?? [],
    utmSources: (savedFilters?.utmSources as string[]) ?? [],
    utmMediums: (savedFilters?.utmMediums as string[]) ?? [],
  };
}

interface LoadedData {
  records: OrderRecord[];
  items: ItemRecord[];
}

function AppInner() {
  const { user, updateUser } = useAuth();
  const apiKey = user?.apiKey ?? "";

  const [filters, setFilters] = useState<Filters>(() =>
    getDefaultFilters(user?.savedFilters)
  );
  const [loadKey, setLoadKey] = useState(1);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const queryClient = useQueryClient();

  const handleFiltersChange = useCallback((partial: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  // Auto-load managers when API key available
  const { data: managers = [] } = useQuery({
    queryKey: ["users", apiKey],
    queryFn: () => fetchUsers(apiKey),
    enabled: apiKey.length > 0,
    staleTime: Infinity,
    retry: false,
  });

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

  // Main data query — triggered by loadKey
  const { data, isFetching, error } = useQuery<LoadedData>({
    queryKey: ["orders", loadKey],
    queryFn: async () => {
      const typesToFetch = filters.selectedTypes.length > 0 ? filters.selectedTypes : [undefined];
      const allOrders = [];
      for (const otype of typesToFetch) {
        const fetched = await fetchOrders({
          apiKey,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          orderType: otype,
          managerIds: filters.managerIds.length > 0 ? filters.managerIds.map(Number) : undefined,
          onProgress: (done, total) => setProgress({ done, total }),
        });
        allOrders.push(...fetched);
      }
      setProgress(null);
      return flattenAll(allOrders);
    },
    enabled: loadKey > 0 && apiKey.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  const handleLoad = useCallback(() => {
    if (!apiKey) return;
    queryClient.removeQueries({ queryKey: ["orders"] });
    setProgress(null);
    setLoadKey((k) => k + 1);
    if (user) {
      const savedFilters: Record<string, unknown> = {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        freq: filters.freq,
        selectedTypes: filters.selectedTypes,
        managerIds: filters.managerIds,
        utmSources: filters.utmSources,
        utmMediums: filters.utmMediums,
      };
      updateUser({ ...user, savedFilters });
    }
  }, [filters, apiKey, queryClient, user, updateUser]);

  const allRecords = data?.records ?? [];
  const items = data?.items ?? [];

  // Extract available UTMs from loaded orders; fall back to saved UTMs
  const availableUtms = useMemo(() => {
    const fromOrders = {
      sources: [...new Set(allRecords.map((r) => r.utmSource).filter(Boolean))] as string[],
      mediums: [...new Set(allRecords.map((r) => r.utmMedium).filter(Boolean))] as string[],
    };
    // Persist newly discovered UTMs into user profile
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

  // Apply client-side UTM filters
  const records = useMemo(() => {
    let result = allRecords;
    if (filters.utmSources.length > 0) {
      result = result.filter((r) => r.utmSource && filters.utmSources.includes(r.utmSource));
    }
    if (filters.utmMediums.length > 0) {
      result = result.filter((r) => r.utmMedium && filters.utmMediums.includes(r.utmMedium));
    }
    return result;
  }, [allRecords, filters.utmSources, filters.utmMediums]);

  const layoutProps = {
    filters,
    managers,
    availableUtms,
    onFiltersChange: handleFiltersChange,
    onLoad: handleLoad,
    loading: isFetching,
  };

  // Block access until API key is configured (after login)
  if (!apiKey) {
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
              <Funnel records={records} freq={filters.freq} />
            </PageShell>
          }
        />
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
      <AuthProvider>
        <AppInner />
      </AuthProvider>
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
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-full max-w-sm bg-slate-200 rounded-full h-2">
          <div
            className="bg-teal h-2 rounded-full transition-all duration-300"
            style={{ width: progress ? `${Math.round((progress.done / progress.total) * 100)}%` : "20%" }}
          />
        </div>
        <p className="text-slate-500 text-sm">
          {progress ? `Página ${progress.done} de ${progress.total}…` : "Iniciando…"}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
        <strong>Error de API:</strong> {(error as Error).message}
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-4 text-sm">
        Selecciona los filtros en el panel lateral y pulsa <strong>Cargar datos</strong>.
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-4 text-sm">
        No se encontraron pedidos para los filtros seleccionados.
      </div>
    );
  }

  return <>{children}</>;
}
