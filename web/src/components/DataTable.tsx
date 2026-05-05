import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Props<T> {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  dark?: boolean;
}

export function DataTable<T>({ data, columns, dark = false }: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const headerBg = dark ? "bg-navy-light" : "bg-slate-50";
  const headerText = dark ? "text-slate-400" : "text-slate-500";
  const rowHover = dark ? "hover:bg-navy-border" : "hover:bg-slate-50";
  const borderColor = dark ? "border-navy-border" : "border-slate-200";
  const cellText = dark ? "text-slate-300" : "text-slate-700";

  return (
    <div className={`overflow-auto rounded-lg border ${borderColor}`}>
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className={headerBg}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-3 py-2 text-left font-semibold uppercase tracking-wide text-xs ${headerText} ${header.column.getCanSort() ? "cursor-pointer select-none" : ""}`}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <span className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      header.column.getIsSorted() === "asc" ? <ChevronUp size={12} /> :
                      header.column.getIsSorted() === "desc" ? <ChevronDown size={12} /> :
                      <ChevronsUpDown size={12} className="opacity-40" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className={`border-t ${borderColor} ${rowHover} transition-colors`}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={`px-3 py-2 ${cellText}`}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className={`px-3 py-6 text-center ${headerText}`}>
                Sin datos
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
