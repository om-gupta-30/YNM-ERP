"use client";

import * as React from "react";
import type { Item, StockLedger } from "@/lib/types";
import { inventoryService, itemService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, TableSkeleton } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TablePagination } from "@/components/ui/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

type TxFilter = "ALL" | "INWARD" | "OUTWARD";

export default function LedgerPage() {
  const { role, factory } = useAuth();
  const { toast } = useToast();

  const viewOk = can.viewLedger(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [items, setItems] = React.useState<Item[]>([]);
  const [rows, setRows] = React.useState<StockLedger[]>([]);

  const [itemId, setItemId] = React.useState<string>("ALL");
  const [txType, setTxType] = React.useState<TxFilter>("ALL");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, ledger] = await Promise.all([
        itemService.getItems(),
        inventoryService.getStockLedger({ factory: factory ?? "YNM-HYD" }),
      ]);
      setItems(items);
      setRows(ledger);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load ledger",
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

  const itemsById = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (itemId !== "ALL" && r.itemId !== itemId) return false;
      if (txType !== "ALL" && r.transactionType !== txType) return false;
      return true;
    });
  }, [itemId, rows, txType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [itemId, txType]);

  if (!viewOk) {
    return (
      <AccessDenied
        title="Stock Ledger"
        message="Stores has full access. Purchase has view-only access. Other roles have no access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Ledger"
        description="Inventory transactions (inward/outward) posted by GRN/production/dispatch."
        hint="Every stock movement is logged here. Filter by item or type to trace where materials went."
      />

      <div className="ds-filter-bar">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-sm font-medium text-stone-700">Item</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            >
              <option value="ALL">All items</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.itemCode} — {i.itemName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Type</label>
            <select
              value={txType}
              onChange={(e) => setTxType(e.target.value as TxFilter)}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            >
              <option value="ALL">All</option>
              <option value="INWARD">Inward</option>
              <option value="OUTWARD">Outward</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={pageSize}
            visibleCount={paged.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            pageSizeOptions={[20, 50, 100]}
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : (
        <DataTable
          rows={paged}
          columns={[
            {
              header: "Item",
              cell: (r) => {
                const it = itemsById.get(r.itemId);
                return it ? `${it.itemCode} — ${it.itemName}` : "—";
              },
            },
            { header: "Type", cell: (r) => <StatusBadge value={r.transactionType} />, className: "w-28" },
            { header: "Qty", cell: (r) => String(r.quantity), className: "text-right w-24" },
            {
              header: "Reference",
              cell: (r) => `${r.referenceType} • ${r.referenceId}`,
              className: "w-56",
            },
            { header: "Date", cell: (r) => new Date(r.createdAt).toLocaleString(), className: "w-44" },
          ]}
          emptyState="No ledger transactions found."
        />
      )}
    </div>
  );
}
