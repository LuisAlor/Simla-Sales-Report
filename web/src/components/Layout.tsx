import { Outlet } from "react-router-dom";
import { Sidebar, type Filters } from "./Sidebar";
import type { SimlaUser } from "@/lib/api";

interface AvailableUtms {
  sources: string[];
  mediums: string[];
}

interface Props {
  filters: Filters;
  managers: SimlaUser[];
  availableUtms: AvailableUtms;
  onFiltersChange: (f: Partial<Filters>) => void;
  onLoad: () => void;
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
