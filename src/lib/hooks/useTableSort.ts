import * as React from "react";
import type { SortConfig } from "@/components/ui/DataTable";

type GetValue<T> = (row: T, key: string) => string | number;

/**
 * Generic hook for sortable tables.
 *
 * Usage:
 *   const { sortConfig, onSort, sorted } = useTableSort(filteredRows, getValue);
 *   const paged = sorted.slice(start, end);
 *   <DataTable rows={paged} sortConfig={sortConfig} onSort={onSort} ... />
 */
export function useTableSort<T>(data: T[], getValue: GetValue<T>) {
  const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(null);

  const onSort = React.useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key && prev.dir === "asc") return { key, dir: "desc" };
      if (prev?.key === key && prev.dir === "desc") return null;
      return { key, dir: "asc" };
    });
  }, []);

  const sorted = React.useMemo(() => {
    if (!sortConfig) return data;
    const { key, dir } = sortConfig;
    return [...data].sort((a, b) => {
      const aVal = getValue(a, key);
      const bVal = getValue(b, key);
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: "base" });
      return dir === "asc" ? cmp : -cmp;
    });
  }, [data, sortConfig, getValue]);

  return { sortConfig, onSort, sorted };
}
