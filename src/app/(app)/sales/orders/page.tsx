"use client";

import * as React from "react";
import Link from "next/link";
import type { Customer, Item, SalesOrder } from "@/lib/types";
import { customerService, itemService, salesService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, TableSkeleton } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { TablePagination } from "@/components/ui/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useTableSort } from "@/lib/hooks/useTableSort";

type Row = { id: string; itemId: string; quantity: number; rate: number };
type StatusFilter = "ALL" | "OPEN" | "IN_PROGRESS" | "COMPLETED";

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
];

function genRowId() {
  return `row_${Math.random().toString(36).slice(2, 10)}`;
}

export default function SalesOrdersPage() {
  const { role, factory, currentUser } = useAuth();
  const { toast } = useToast();

  const viewOk = can.viewSO(role);
  const canCreate = can.createSO(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);

  const [orders, setOrders] = React.useState<SalesOrder[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [items, setItems] = React.useState<Item[]>([]);

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [open, setOpen] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [orderDate, setOrderDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = React.useState<Row[]>([{ id: genRowId(), itemId: "", quantity: 1, rate: 0 }]);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [orders, customers, items] = await Promise.all([
        salesService.getSalesOrders({ factory: factory ?? "YNM-HYD" }),
        customerService.getCustomers(),
        itemService.getItems(),
      ]);
      setOrders(orders);
      setCustomers(customers.filter((c) => c.isActive));
      setItems(items.filter((i) => i.isActive && i.itemType === "FINISHED_GOOD"));
      setCustomerId((prev) => prev || customers.find((c) => c.isActive)?.id || "");
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load sales orders",
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

  const customerById = React.useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );

  const filtered = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (!q) return true;
      const c = customerById.get(o.customerId);
      return (
        o.soNumber.toLowerCase().includes(q) ||
        (c?.customerName.toLowerCase().includes(q) ?? false)
      );
    });
  }, [orders, debouncedSearch, statusFilter, customerById]);

  const getSortValue = React.useCallback((row: SalesOrder, key: string) => {
    if (key === "number") return row.soNumber;
    if (key === "date") return row.orderDate;
    if (key === "status") return row.status;
    return "";
  }, []);

  const { sortConfig, onSort, sorted } = useTableSort(filtered, getSortValue);

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
  }, [debouncedSearch, statusFilter]);

  function addRow() {
    setRows((p) => [...p, { id: genRowId(), itemId: "", quantity: 1, rate: 0 }]);
  }

  function removeRow(id: string) {
    setRows((p) => {
      const next = p.filter((r) => r.id !== id);
      return next.length ? next : [{ id: genRowId(), itemId: "", quantity: 1, rate: 0 }];
    });
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const selectedIds = new Set(rows.map((r) => r.itemId).filter(Boolean));

  function validate() {
    if (!customerId) return "Customer is required.";
    const ids = rows.map((r) => r.itemId).filter(Boolean);
    if (!ids.length) return "Add at least one item.";
    if (new Set(ids).size !== ids.length) return "Duplicate items are not allowed.";
    for (const r of rows) {
      if (!r.itemId) return "Each row must have an item selected.";
      if (!Number.isFinite(r.quantity) || r.quantity <= 0) return "Quantity must be > 0.";
      if (!Number.isFinite(r.rate) || r.rate < 0) return "Rate must be >= 0.";
    }
    return null;
  }

  async function onCreate() {
    setError(null);
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setIsMutating(true);
    try {
      await salesService.createSalesOrder({
        customerId,
        orderDate,
        items: rows.map((r) => ({ itemId: r.itemId, quantity: r.quantity, rate: r.rate })),
        factory: factory ?? "YNM-HYD",
      }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "Sales order created" });
      setOpen(false);
      setRows([{ id: genRowId(), itemId: "", quantity: 1, rate: 0 }]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setIsMutating(false);
    }
  }

  if (!viewOk) {
    return (
      <AccessDenied
        title="Sales Orders"
        message="Sales can create sales orders. Admin has full view. Other roles have no access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Orders"
        description="Create and track sales orders."
        hint="Enter customer orders here. Once confirmed, you can dispatch the goods and generate an invoice."
        flowCurrent="/sales/orders"
        flowNext={{ label: "Dispatch", href: "/dispatch" }}
        actions={
          canCreate ? (
            <Button onClick={() => setOpen(true)} disabled={isLoading || isMutating}>
              New Sales Order
            </Button>
          ) : (
            <div className="text-sm text-stone-500">View only</div>
          )
        }
      />

      <div className="ds-filter-bar">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SO number or customer"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
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
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <DataTable
          rows={paged}
          sortConfig={sortConfig}
          onSort={onSort}
          columns={[
            { header: "SO No.", accessor: "soNumber", sortKey: "number" },
            {
              header: "Customer",
              cell: (r) => customerById.get(r.customerId)?.customerName ?? "—",
            },
            { header: "Order date", accessor: "orderDate", className: "w-32", sortKey: "date" },
            { header: "Status", cell: (r) => <StatusBadge value={r.status} />, className: "w-28", sortKey: "status" },
            {
              header: "Actions",
              cell: () => (
                <div className="flex justify-end">
                  <Link href="/dispatch">
                    <Button variant="secondary" size="sm">Dispatch</Button>
                  </Link>
                </div>
              ),
              className: "text-right w-28",
            },
          ]}
          emptyState="No sales orders yet. Click 'New Sales Order' to enter a customer order."
        />
      )}

      <FormModal
        open={open}
        title="Create Sales Order"
        description="Select customer and add finished goods with quantity and rate."
        onClose={() => {
          if (isMutating) return;
          setOpen(false);
          setError(null);
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isMutating}>
              Cancel
            </Button>
            <Button onClick={() => void onCreate()} disabled={isMutating}>
              {isMutating ? "Creating…" : "Create"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="ds-label">Customer</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="ds-select"
              >
                <option value="">Select customer…</option>
                {customers.filter((c) => c.isActive).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customerCode} — {c.customerName}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Order date"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-stone-950">Items</div>
            <Button type="button" variant="secondary" onClick={addRow}>
              Add row
            </Button>
          </div>

          <div className="ds-table-wrap ring-0 shadow-none">
            <div className="ds-table-scroll">
              <table className="ds-table">
                <thead className="ds-thead">
                <tr>
                  <th className="ds-th">Item</th>
                  <th className="ds-th">UOM</th>
                  <th className="ds-th text-right">Qty</th>
                  <th className="ds-th text-right">Rate</th>
                  <th className="ds-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                {rows.map((r) => (
                  <tr key={r.id} className="ds-tr">
                    <td className="ds-td">
                      <select
                        value={r.itemId}
                        onChange={(e) => updateRow(r.id, { itemId: e.target.value })}
                        className="ds-select"
                      >
                        <option value="">Select item…</option>
                        {items.map((i) => {
                          const used = selectedIds.has(i.id) && i.id !== r.itemId;
                          return (
                            <option key={i.id} value={i.id} disabled={used}>
                              {i.itemCode} — {i.itemName}
                            </option>
                          );
                        })}
                      </select>
                    </td>
                    <td className="ds-td text-xs text-stone-500">
                      {r.itemId ? (items.find((i) => i.id === r.itemId)?.uom ?? "—") : "—"}
                    </td>
                    <td className="ds-td text-right">
                      <input
                        type="number"
                        min={1}
                        step="1"
                        value={String(r.quantity)}
                        onChange={(e) => updateRow(r.id, { quantity: Number(e.target.value) })}
                        className="ds-input w-24 text-right"
                      />
                    </td>
                    <td className="ds-td text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={String(r.rate)}
                        onChange={(e) => updateRow(r.id, { rate: Number(e.target.value) })}
                        className="ds-input w-28 text-right"
                      />
                    </td>
                    <td className="ds-td text-right">
                      <Button type="button" variant="ghost" onClick={() => removeRow(r.id)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>

          {error ? (
            <div className="ds-alert-error text-sm">
              {error}
            </div>
          ) : null}
        </div>
      </FormModal>
    </div>
  );
}
