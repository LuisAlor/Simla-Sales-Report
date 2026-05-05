import { Outlet } from "react-router-dom";
import { Sidebar, type Filters } from "./Sidebar";
import type { FilterTemplate } from "@/lib/auth";

interface AvailableUtms {
  sources: string[];
  mediums: string[];
}

interface Props {
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
}

export function Layout(props: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar {...props} />
      <main className="flex-1 h-screen overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
