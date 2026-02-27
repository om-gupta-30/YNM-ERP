"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Customer, Dispatch, SalesOrder } from "@/lib/types";
import { customerService, salesService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, TableSkeleton } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormModal } from "@/components/ui/FormModal";
import { TablePagination } from "@/components/ui/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useTableSort } from "@/lib/hooks/useTableSort";

type StatusFilter = "ALL" | "PENDING" | "DISPATCHED";

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "DISPATCHED", label: "Dispatched" },
];

export default function DispatchListPage() {
  const router = useRouter();
  const { role, factory, currentUser } = useAuth();
  const { toast } = useToast();
  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  const viewOk = can.viewDispatch(role);
  const canCreate = can.dispatch(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [dispatches, setDispatches] = React.useState<Dispatch[]>([]);
  const [orders, setOrders] = React.useState<SalesOrder[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [open, setOpen] = React.useState(false);
  const [soId, setSoId] = React.useState("");
  const [dispatchDate, setDispatchDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [dispatches, orders, customers] = await Promise.all([
        salesService.getDispatches({ factory: factory ?? "YNM-HYD" }),
        salesService.getSalesOrders({ factory: factory ?? "YNM-HYD" }),
        customerService.getCustomers(),
      ]);
      setDispatches(dispatches);
      setOrders(orders);
      setCustomers(customers);
      setSoId((prev) => prev || orders.find((o) => o.status !== "COMPLETED")?.id || "");
    } catch (err) {
      toastRef.current({
        variant: "error",
        title: "Failed to load dispatch",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [factory]);

  React.useEffect(() => {
    if (!viewOk) return;
    void refresh();
  }, [viewOk, factory]); // eslint-disable-line react-hooks/exhaustive-deps

  const customerById = React.useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );
  const orderById = React.useMemo(
    () => new Map(orders.map((o) => [o.id, o])),
    [orders],
  );

  const filtered = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return dispatches.filter((d) => {
      if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
      if (!q) return true;
      const so = orderById.get(d.soId);
      const c = so ? customerById.get(so.customerId) : null;
      return (
        d.dispatchNumber.toLowerCase().includes(q) ||
        (so?.soNumber.toLowerCase().includes(q) ?? false) ||
        (c?.customerName.toLowerCase().includes(q) ?? false)
      );
    });
  }, [dispatches, debouncedSearch, statusFilter, orderById, customerById]);

  const getSortValue = React.useCallback((row: Dispatch, key: string) => {
    if (key === "number") return row.dispatchNumber;
    if (key === "date") return row.dispatchDate;
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

  async function onCreate() {
    setError(null);
    if (!soId) {
      setError("Select a sales order.");
      return;
    }
    setIsMutating(true);
    try {
      const d = await salesService.createDispatch({ soId, dispatchDate, factory: factory ?? "YNM-HYD" }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toastRef.current({ variant: "success", title: "Dispatch created" });
      setOpen(false);
      await refresh();
      router.push(`/dispatch/${d.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setIsMutating(false);
    }
  }

  if (!viewOk) {
    return (
      <AccessDenied
        title="Dispatch"
        message="Stores dispatch goods. Accounts generates invoices. Admin has full view. Other roles have no access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch"
        description="Create dispatches against sales orders. Posts OUTWARD stock ledger entries."
        hint="Pick a sales order, specify how many units to ship, and dispatch. This deducts stock and creates an outward ledger entry."
        flowCurrent="/dispatch"
        flowNext={{ label: "Invoices", href: "/dispatch/invoices" }}
        actions={
          canCreate ? (
            <Button onClick={() => setOpen(true)} disabled={isLoading || isMutating}>
              New Dispatch
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
            placeholder="Search by dispatch no., SO, or customer"
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
        <TableSkeleton rows={6} cols={6} />
      ) : (
        <DataTable
          rows={paged}
          sortConfig={sortConfig}
          onSort={onSort}
          columns={[
            {
              header: "Dispatch No.",
              sortKey: "number",
              cell: (r) => (
                <Link href={`/dispatch/${r.id}`} className="font-medium text-stone-900 hover:underline">
                  {r.dispatchNumber}
                </Link>
              ),
            },
            {
              header: "Sales Order",
              cell: (r) => orderById.get(r.soId)?.soNumber ?? "—",
            },
            {
              header: "Customer",
              cell: (r) => {
                const so = orderById.get(r.soId);
                const c = so ? customerById.get(so.customerId) : null;
                return c ? `${c.customerCode} — ${c.customerName}` : "—";
              },
            },
            { header: "Dispatch date", accessor: "dispatchDate", sortKey: "date", className: "w-32" },
            { header: "Status", cell: (r) => <StatusBadge value={r.status} />, sortKey: "status", className: "w-28" },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  <Link href={`/dispatch/${r.id}`}>
                    <Button variant="secondary" size="sm">View</Button>
                  </Link>
                  {r.status === "DISPATCHED" ? (
                    <Link href={`/dispatch/invoice/${r.id}`}>
                      <Button variant="secondary" size="sm">Invoice</Button>
                    </Link>
                  ) : null}
                </div>
              ),
              className: "text-right w-44",
            },
          ]}
          emptyState="No dispatches yet. Create one from a confirmed sales order."
        />
      )}

      <FormModal
        open={open}
        title="Create Dispatch"
        description="Select a sales order to create a pending dispatch."
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
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Sales order</label>
            <select
              value={soId}
              onChange={(e) => setSoId(e.target.value)}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            >
              <option value="">Select SO…</option>
              {orders
                .filter((o) => o.status !== "COMPLETED")
                .map((o) => {
                  const c = customerById.get(o.customerId);
                  return (
                    <option key={o.id} value={o.id}>
                      {o.soNumber} • {c ? `${c.customerCode} — ${c.customerName}` : "—"} • {o.status}
                    </option>
                  );
                })}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Dispatch date</label>
            <input
              type="date"
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            />
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
