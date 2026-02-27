"use client";

import * as React from "react";
import type { Item } from "@/lib/types";
import { inventoryService, itemService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, TableSkeleton } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import { Input } from "@/components/ui/Input";
import { TablePagination } from "@/components/ui/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useTableSort } from "@/lib/hooks/useTableSort";

type Row = {
  id: string;
  itemCode: string;
  itemName: string;
  uom: string;
  reorderLevel: number;
  onHand: number;
  low: boolean;
};

type IndicatorFilter = "ALL" | "LOW" | "OK";

export default function StockPage() {
  const { role, factory } = useAuth();
  const { toast } = useToast();

  const viewOk = can.viewStock(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [items, setItems] = React.useState<Item[]>([]);
  const [stock, setStock] = React.useState<Record<string, number>>({});
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [indicator, setIndicator] = React.useState<IndicatorFilter>("ALL");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, stock] = await Promise.all([
        itemService.getItems(),
        inventoryService.getCurrentStock({ factory: factory ?? "YNM-HYD" }),
      ]);
      setItems(items);
      setStock(stock);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load stock",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [factory, toast]);

  React.useEffect(() => {
    if (!viewOk) return;
    void refresh();
  }, [refresh, viewOk]);

  const allRows = React.useMemo<Row[]>(() => {
    return items
      .filter((i) => i.isActive)
      .map((i) => {
        const onHand = stock[i.id] ?? 0;
        const low = onHand <= i.reorderLevel;
        return {
          id: i.id,
          itemCode: i.itemCode,
          itemName: i.itemName,
          uom: i.uom,
          reorderLevel: i.reorderLevel,
          onHand,
          low,
        };
      })
      .sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  }, [items, stock]);

  const filtered = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return allRows.filter((r) => {
      if (indicator === "LOW" && !r.low) return false;
      if (indicator === "OK" && r.low) return false;
      if (!q) return true;
      return r.itemCode.toLowerCase().includes(q) || r.itemName.toLowerCase().includes(q);
    });
  }, [allRows, debouncedSearch, indicator]);

  const getSortValue = React.useCallback((row: Row, key: string) => {
    switch (key) {
      case "code": return row.itemCode;
      case "name": return row.itemName;
      case "stock": return row.onHand;
      case "reorder": return row.reorderLevel;
      default: return "";
    }
  }, []);

  const { sortConfig, onSort, sorted } = useTableSort(filtered, getSortValue);

  const lowCount = allRows.filter((r) => r.low).length;
  const totalQty = allRows.reduce((s, r) => s + r.onHand, 0);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, indicator]);

  if (!viewOk) {
    return (
      <AccessDenied
        title="Stock"
        message="Stores has full access. Purchase has view-only access. Other roles have no access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Overview"
        description="Current stock position calculated from ledger postings."
        hint="A live view of how much of each item you have on hand. Red = below reorder level."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Active items" value={allRows.length} />
        <KpiCard label="Low stock items" value={lowCount} hint="On hand ≤ reorder level" />
        <KpiCard label="Total on-hand qty" value={totalQty} />
      </div>

      <div className="ds-filter-bar">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item code or name"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Indicator</label>
            <select
              value={indicator}
              onChange={(e) => setIndicator(e.target.value as IndicatorFilter)}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            >
              <option value="ALL">All</option>
              <option value="LOW">Low stock only</option>
              <option value="OK">OK only</option>
            </select>
          </div>
          <div className="flex items-end" />
        </div>

        <div className="mt-3">
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={sorted.length}
            pageSize={pageSize}
            visibleCount={paged.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            pageSizeOptions={[20, 50, 100]}
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : (
        <DataTable
          rows={paged}
          sortConfig={sortConfig}
          onSort={onSort}
          columns={[
            { header: "Item Code", accessor: "itemCode", sortKey: "code" },
            { header: "Item Name", accessor: "itemName", sortKey: "name" },
            { header: "UOM", accessor: "uom", className: "w-20" },
            { header: "Reorder", cell: (r) => String(r.reorderLevel), className: "text-right w-24", sortKey: "reorder" },
            { header: "On hand", cell: (r) => String(r.onHand), className: "text-right w-24", sortKey: "stock" },
            {
              header: "Indicator",
              cell: (r) => (
                <StatusBadge value={r.low ? "Low" : "OK"} />
              ),
              className: "w-24",
            },
          ]}
          emptyState="No stock data. Stock appears here after GRN approvals or production receipts."
        />
      )}
    </div>
  );
}
