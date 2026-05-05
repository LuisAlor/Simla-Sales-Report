import { Outlet } from "react-router-dom";
import { Sidebar, type Filters } from "./Sidebar";
import type { OrderType } from "@/lib/api";

interface Props {
  filters: Filters;
  orderTypes: OrderType[];
  onFiltersChange: (f: Partial<Filters>) => void;
  onLoad: () => void;
  loading: boolean;
}

export function Layout(props: Props) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar {...props} />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
