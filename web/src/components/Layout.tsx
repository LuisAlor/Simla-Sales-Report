import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopFilters } from "./TopFilters";
import type { Filters } from "@/lib/filters";
import type { FilterTemplate } from "@/lib/auth";

interface AvailableUtms {
  sources: string[];
  mediums: string[];
}

export interface LayoutProps {
  filters: Filters;
  managers: { value: string; label: string }[];
  availableUtms: AvailableUtms;
  filterTemplates: FilterTemplate[];
  onFiltersChange: (f: Partial<Filters>) => void;
  onLoad: () => void;
  onReset: () => void;
  onSaveTemplate: (name: string) => void;
  onApplyTemplate: (t: FilterTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onReorderTemplates: (templates: FilterTemplate[]) => void;
  loading: boolean;
  cachedAt: number | null;
  hasApiKey: boolean;
}

// Routes on which the filter bar is shown
const FILTER_ROUTES = new Set(["/", "/funnel"]);

export function Layout(props: LayoutProps) {
  const location = useLocation();
  const showFilters = FILTER_ROUTES.has(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        {showFilters && <TopFilters {...props} />}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
