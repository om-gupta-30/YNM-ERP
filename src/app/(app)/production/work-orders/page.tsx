"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Item, WorkOrder } from "@/lib/types";
import { itemService, productionService } from "@/lib/services";
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

type StatusFilter = "ALL" | "OPEN" | "IN_PROGRESS" | "COMPLETED";

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
];

export default function WorkOrdersPage() {
  const router = useRouter();
  const { role, factory, currentUser } = useAuth();
  const { toast } = useToast();

  const viewOk = can.viewProduction(role);
  const canCreate = can.createWO(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const [workOrders, setWorkOrders] = React.useState<WorkOrder[]>([]);
  const [producedByWoId, setProducedByWoId] = React.useState<Record<string, number>>({});

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [fgItemId, setFgItemId] = React.useState("");
  const [qtyPlanned, setQtyPlanned] = React.useState<number>(1000);
  const [formError, setFormError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, wos] = await Promise.all([
        itemService.getItems(),
        productionService.getWorkOrders({ factory: factory ?? "YNM-HYD" }),
      ]);
      setItems(items);
      setWorkOrders(wos);

      const punches = await Promise.all(wos.map((w) => productionService.getProductionPunches(w.id)));
      const produced: Record<string, number> = {};
      wos.forEach((w, idx) => {
        produced[w.id] = punches[idx].reduce((s, p) => s + p.quantityProduced, 0);
      });
      setProducedByWoId(produced);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load work orders",
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

  const fgItems = React.useMemo(
    () => items.filter((i) => i.isActive && i.itemType === "FINISHED_GOOD"),
    [items],
  );
  const itemById = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const filtered = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return workOrders.filter((w) => {
      if (statusFilter !== "ALL" && w.status !== statusFilter) return false;
      if (!q) return true;
      const it = itemById.get(w.finishedGoodItemId);
      return (
        w.woNumber.toLowerCase().includes(q) ||
        (it?.itemCode.toLowerCase().includes(q) ?? false) ||
        (it?.itemName.toLowerCase().includes(q) ?? false)
      );
    });
  }, [workOrders, debouncedSearch, statusFilter, itemById]);

  const getSortValue = React.useCallback((row: WorkOrder, key: string) => {
    if (key === "number") return row.woNumber;
    if (key === "status") return row.status;
    if (key === "qty") return row.quantityPlanned;
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

  if (!viewOk) {
    return (
      <AccessDenied
        title="Work Orders"
        message="Planning can create work orders. Stores issues materials. Production punches output. Admin has full view."
      />
    );
  }

  async function onCreate() {
    setFormError(null);
    if (!fgItemId) {
      setFormError("Finished good is required.");
      return;
    }
    if (!Number.isFinite(qtyPlanned) || qtyPlanned <= 0) {
      setFormError("Planned quantity must be > 0.");
      return;
    }
    setIsMutating(true);
    try {
      const wo = await productionService.createWorkOrder({
        finishedGoodItemId: fgItemId,
        quantityPlanned: qtyPlanned,
        factory: factory ?? "YNM-HYD",
      }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "Work order created" });
      setCreateOpen(false);
      await refresh();
      router.push(`/production/issue/${wo.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Orders"
        description="Plan production using BOM and track execution."
        hint="Create a work order to produce a finished good. Then issue materials from stock and punch production output."
        flowCurrent="/production/work-orders"
        flowNext={{ label: "Production", href: "/production/dashboard" }}
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)} disabled={isLoading || isMutating}>
              New Work Order
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
            placeholder="Search by WO number or FG item"
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
            { header: "WO Number", accessor: "woNumber", sortKey: "number" },
            {
              header: "FG Item",
              cell: (r) => {
                const it = itemById.get(r.finishedGoodItemId);
                return it ? `${it.itemCode} — ${it.itemName}` : "—";
              },
            },
            {
              header: "Qty",
              cell: (r) => String(r.quantityPlanned),
              className: "text-right w-24",
              sortKey: "qty",
            },
            {
              header: "Progress",
              cell: (r) => {
                const produced = producedByWoId[r.id] ?? 0;
                const pct = r.quantityPlanned > 0 ? Math.min((produced / r.quantityPlanned) * 100, 100) : 0;
                return (
                  <div className="min-w-[180px]">
                    <div className="flex items-center justify-between text-xs text-stone-600">
                      <span>{produced} / {r.quantityPlanned}</span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-stone-100 border border-stone-200">
                      <div className="h-2 rounded-full bg-stone-900" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              },
            },
            { header: "Status", cell: (r) => <StatusBadge value={r.status} />, className: "w-28", sortKey: "status" },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  <Link href={`/production/issue/${r.id}`}>
                    <Button variant="secondary" size="sm">Issue</Button>
                  </Link>
                  <Link href={`/production/punch/${r.id}`}>
                    <Button variant="secondary" size="sm">Punch</Button>
                  </Link>
                </div>
              ),
              className: "text-right w-40",
            },
          ]}
          emptyState="No work orders yet. Click 'New Work Order' to plan a production run."
        />
      )}

      <FormModal
        open={createOpen}
        title="Create Work Order"
        description="Select finished good and planned quantity. BOM will be auto-loaded."
        onClose={() => {
          if (isMutating) return;
          setCreateOpen(false);
          setFormError(null);
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={isMutating}>
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
            <label className="block text-sm font-medium text-stone-700">Finished Good</label>
            <select
              value={fgItemId}
              onChange={(e) => setFgItemId(e.target.value)}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            >
              <option value="">Select FG…</option>
              {fgItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.itemCode} — {i.itemName}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Planned quantity"
            type="number"
            min={1}
            value={String(qtyPlanned)}
            onChange={(e) => setQtyPlanned(Number(e.target.value))}
          />
          {formError ? (
            <div className="ds-alert-error text-sm">
              {formError}
            </div>
          ) : null}
        </div>
      </FormModal>
    </div>
  );
}
