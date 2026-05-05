import { useState, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Layout } from "@/components/Layout";
import { Analytics } from "@/pages/Analytics";
import { Funnel } from "@/pages/Funnel";
import { fetchOrders, fetchOrderTypes } from "@/lib/api";
import { flattenAll } from "@/lib/flatten";
import type { Filters } from "@/components/Sidebar";
import type { OrderRecord, ItemRecord } from "@/lib/flatten";

const DEFAULT_FILTERS: Filters = {
  apiKey: "",
  dateFrom: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
  dateTo: dayjs().format("YYYY-MM-DD"),
  freq: "D",
  selectedTypes: ["crm-license"],
  managerId: "",
};

interface LoadedData {
  records: OrderRecord[];
  items: ItemRecord[];
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loadKey, setLoadKey] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const queryClient = useQueryClient();

  const handleFiltersChange = useCallback((partial: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  // Fetch order types when API key is available
  const { data: orderTypes = [] } = useQuery({
    queryKey: ["orderTypes", filters.apiKey],
    queryFn: () => fetchOrderTypes(filters.apiKey),
    enabled: filters.apiKey.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  // Main data query — triggered by loadKey
  const {
    data,
    isFetching,
    error,
  } = useQuery<LoadedData>({
    queryKey: ["orders", loadKey],
    queryFn: async () => {
      const typesToFetch = filters.selectedTypes.length > 0 ? filters.selectedTypes : [undefined];
      const allOrders = [];
      for (const otype of typesToFetch) {
        const fetched = await fetchOrders({
          apiKey: filters.apiKey,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          orderType: otype,
          managerId: filters.managerId ? parseInt(filters.managerId) : undefined,
          onProgress: (done, total) => setProgress({ done, total }),
        });
        allOrders.push(...fetched);
      }
      setProgress(null);
      const { records, items } = flattenAll(allOrders);
      return { records, items };
    },
    enabled: loadKey > 0 && filters.apiKey.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  const handleLoad = useCallback(() => {
    if (!filters.apiKey) return;
    queryClient.removeQueries({ queryKey: ["orders"] });
    setProgress(null);
    setLoadKey((k) => k + 1);
  }, [filters, queryClient]);

  const records = data?.records ?? [];
  const items = data?.items ?? [];

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <Layout
              filters={filters}
              orderTypes={orderTypes}
              onFiltersChange={handleFiltersChange}
              onLoad={handleLoad}
              loading={isFetching}
            />
          }
        >
          <Route
            index
            element={
              <PageShell loading={isFetching} progress={progress} error={error} hasData={records.length > 0} loaded={loadKey > 0}>
                <Analytics records={records} items={items} freq={filters.freq} />
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
        </Route>
      </Routes>
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
        Introduce tu API Key en el panel lateral y pulsa <strong>Cargar datos</strong>.
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
