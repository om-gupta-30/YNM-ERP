"use client";

import * as React from "react";
import type { Item, Supplier, SupplierItemPrice } from "@/lib/types";
import { itemService, supplierService, supplierItemPriceService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, TableSkeleton } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormModal } from "@/components/ui/FormModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TablePagination } from "@/components/ui/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useTableSort } from "@/lib/hooks/useTableSort";

type FormValues = {
  supplierId: string;
  itemId: string;
  unitPrice: string;
  taxPercent: string;
  leadTimeDays: string;
  minOrderQty: string;
  effectiveFrom: string;
  effectiveTo: string;
  remarks: string;
};

const EMPTY_FORM: FormValues = {
  supplierId: "",
  itemId: "",
  unitPrice: "",
  taxPercent: "18",
  leadTimeDays: "7",
  minOrderQty: "1",
  effectiveFrom: "",
  effectiveTo: "",
  remarks: "",
};

type EnrichedRow = SupplierItemPrice & {
  supplierCode: string;
  supplierName: string;
  itemCode: string;
  itemName: string;
  landedPrice: number;
};

export default function RateCardPage() {
  const { role, currentUser } = useAuth();
  const { toast } = useToast();

  const canView = can.viewRateMaster(role);
  const canEdit = can.editRateMaster(role);

  const [prices, setPrices] = React.useState<SupplierItemPrice[]>([]);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [items, setItems] = React.useState<Item[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [supplierFilter, setSupplierFilter] = React.useState("");
  const [itemFilter, setItemFilter] = React.useState("");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormValues>(EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deletingRow, setDeletingRow] = React.useState<EnrichedRow | null>(null);

  const supplierById = React.useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const itemById = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const enriched: EnrichedRow[] = React.useMemo(
    () =>
      prices.map((p) => {
        const sup = supplierById.get(p.supplierId);
        const itm = itemById.get(p.itemId);
        return {
          ...p,
          supplierCode: sup?.supplierCode ?? "—",
          supplierName: sup?.supplierName ?? "—",
          itemCode: itm?.itemCode ?? "—",
          itemName: itm?.itemName ?? "—",
          landedPrice: Number((p.unitPrice * (1 + p.taxPercent / 100)).toFixed(4)),
        };
      }),
    [prices, supplierById, itemById],
  );

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [p, s, i] = await Promise.all([
        supplierItemPriceService.getAll(),
        supplierService.getSuppliers(),
        itemService.getItems(),
      ]);
      setPrices(p);
      setSuppliers(s);
      setItems(i);
    } catch (err) {
      toast({ variant: "error", title: "Failed to load rate card", message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!canView) return;
    void refresh();
  }, [canView, refresh]);

  const filtered = React.useMemo(() => {
    let result = enriched;
    if (supplierFilter) result = result.filter((r) => r.supplierId === supplierFilter);
    if (itemFilter) result = result.filter((r) => r.itemId === itemFilter);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.supplierCode.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q) ||
          r.itemCode.toLowerCase().includes(q) ||
          r.itemName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [enriched, supplierFilter, itemFilter, debouncedSearch]);

  const getSortValue = React.useCallback((row: EnrichedRow, key: string) => {
    if (key === "supplier") return row.supplierName;
    if (key === "item") return row.itemName;
    if (key === "price") return row.unitPrice;
    if (key === "landed") return row.landedPrice;
    if (key === "lead") return row.leadTimeDays;
    return "";
  }, []);
  const { sortConfig, onSort, sorted } = useTableSort(filtered, getSortValue);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  React.useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  React.useEffect(() => { setPage(1); }, [debouncedSearch, supplierFilter, itemFilter]);

  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  function openCreate() {
    setFormMode("create");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(r: EnrichedRow) {
    setFormMode("edit");
    setEditingId(r.id);
    setForm({
      supplierId: r.supplierId,
      itemId: r.itemId,
      unitPrice: String(r.unitPrice),
      taxPercent: String(r.taxPercent),
      leadTimeDays: String(r.leadTimeDays),
      minOrderQty: String(r.minOrderQty),
      effectiveFrom: r.effectiveFrom ?? "",
      effectiveTo: r.effectiveTo ?? "",
      remarks: r.remarks,
    });
    setFormError(null);
    setFormOpen(true);
  }

  function validate(): string | null {
    if (!form.supplierId) return "Select a supplier.";
    if (!form.itemId) return "Select an item.";
    const price = parseFloat(form.unitPrice);
    if (!Number.isFinite(price) || price < 0) return "Unit price must be >= 0.";
    const tax = parseFloat(form.taxPercent);
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) return "Tax % must be 0–100.";
    const days = parseInt(form.leadTimeDays, 10);
    if (!Number.isFinite(days) || days < 0) return "Lead time must be >= 0 days.";
    const moq = parseFloat(form.minOrderQty);
    if (!Number.isFinite(moq) || moq <= 0) return "Min order qty must be > 0.";
    return null;
  }

  async function onSubmit() {
    setFormError(null);
    const msg = validate();
    if (msg) { setFormError(msg); return; }
    setIsMutating(true);
    try {
      const actor = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
      if (formMode === "create") {
        await supplierItemPriceService.create({
          supplierId: form.supplierId,
          itemId: form.itemId,
          unitPrice: parseFloat(form.unitPrice),
          taxPercent: parseFloat(form.taxPercent),
          leadTimeDays: parseInt(form.leadTimeDays, 10),
          minOrderQty: parseFloat(form.minOrderQty),
          effectiveFrom: form.effectiveFrom || null,
          effectiveTo: form.effectiveTo || null,
          remarks: form.remarks,
        }, actor);
        toast({ variant: "success", title: "Rate added" });
      } else {
        await supplierItemPriceService.update(editingId!, {
          unitPrice: parseFloat(form.unitPrice),
          taxPercent: parseFloat(form.taxPercent),
          leadTimeDays: parseInt(form.leadTimeDays, 10),
          minOrderQty: parseFloat(form.minOrderQty),
          effectiveFrom: form.effectiveFrom || null,
          effectiveTo: form.effectiveTo || null,
          remarks: form.remarks,
        }, actor);
        toast({ variant: "success", title: "Rate updated" });
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsMutating(false);
    }
  }

  async function doDelete() {
    if (!deletingRow) return;
    setIsMutating(true);
    try {
      const actor = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
      await supplierItemPriceService.remove(deletingRow.id, actor);
      toast({ variant: "success", title: "Rate deleted" });
      await refresh();
    } catch (err) {
      toast({ variant: "error", title: "Delete failed", message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsMutating(false);
      setConfirmOpen(false);
      setDeletingRow(null);
    }
  }

  const activeSuppliers = suppliers.filter((s) => s.isActive);
  const activeItems = items.filter((i) => i.isActive);

  if (!canView) {
    return <AccessDenied title="Rate Master" message="Only admin/purchase can manage the supplier rate card." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate Master"
        description="Maintain supplier-wise item rates for automatic L1/L2/L3 ranking."
        hint="Add the standard rates from each supplier for each item. These are used to auto-fill RFQ quotes and find the best-priced supplier instantly."
        actions={
          canEdit ? (
            <Button onClick={openCreate} disabled={isLoading || isMutating}>
              Add Rate
            </Button>
          ) : (
            <div className="text-sm text-stone-500">View only</div>
          )
        }
      />

      <div className="ds-filter-bar">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Supplier or item code/name"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Supplier</label>
            <select
              value={supplierFilter}
              onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            >
              <option value="">All suppliers</option>
              {activeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.supplierCode} — {s.supplierName}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Item</label>
            <select
              value={itemFilter}
              onChange={(e) => { setItemFilter(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            >
              <option value="">All items</option>
              {activeItems.map((i) => <option key={i.id} value={i.id}>{i.itemCode} — {i.itemName}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <div className="text-xs text-stone-500">
              {enriched.length} rate{enriched.length !== 1 ? "s" : ""} total
            </div>
          </div>
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
        <TableSkeleton rows={6} cols={7} />
      ) : (
        <DataTable
          rows={paged}
          sortConfig={sortConfig}
          onSort={onSort}
          columns={[
            {
              header: "Supplier",
              sortKey: "supplier",
              cell: (r) => (
                <div>
                  <div className="text-sm font-medium text-stone-900">{r.supplierCode}</div>
                  <div className="text-xs text-stone-500">{r.supplierName}</div>
                </div>
              ),
            },
            {
              header: "Item",
              sortKey: "item",
              cell: (r) => (
                <div>
                  <div className="text-sm font-medium text-stone-900">{r.itemCode}</div>
                  <div className="text-xs text-stone-500">{r.itemName}</div>
                </div>
              ),
            },
            {
              header: "Unit Price (₹)",
              sortKey: "price",
              cell: (r) => <span className="text-sm font-medium text-stone-900">{r.unitPrice.toFixed(2)}</span>,
              className: "text-right",
            },
            {
              header: "Tax %",
              cell: (r) => <span className="text-sm text-stone-700">{r.taxPercent}%</span>,
              className: "text-right",
            },
            {
              header: "Landed (₹)",
              sortKey: "landed",
              cell: (r) => <span className="text-sm font-semibold text-stone-900">{r.landedPrice.toFixed(2)}</span>,
              className: "text-right",
            },
            {
              header: "Lead Time",
              sortKey: "lead",
              cell: (r) => <span className="text-sm text-stone-700">{r.leadTimeDays}d</span>,
              className: "text-right",
            },
            {
              header: "Status",
              cell: (r) => <StatusBadge value={r.isActive ? "Active" : "Inactive"} />,
            },
            {
              header: "Actions",
              cell: (r) =>
                canEdit ? (
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(r)} disabled={isMutating}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => { setDeletingRow(r); setConfirmOpen(true); }} disabled={isMutating}>Delete</Button>
                  </div>
                ) : (
                  <div className="text-right text-sm text-stone-500">—</div>
                ),
              className: "text-right",
            },
          ]}
          emptyState="No rates found. Click 'Add Rate' above to add supplier-item pricing."
        />
      )}

      <FormModal
        open={formOpen}
        title={formMode === "create" ? "Add Supplier Rate" : "Edit Supplier Rate"}
        description={formMode === "create" ? "Set the standard rate a supplier charges for an item." : "Update the rate for this supplier-item pair."}
        onClose={() => { if (!isMutating) setFormOpen(false); }}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={isMutating}>Cancel</Button>
            <Button onClick={() => void onSubmit()} disabled={isMutating}>
              {isMutating ? "Saving…" : formMode === "create" ? "Add Rate" : "Update Rate"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formError && <div className="ds-alert-error text-sm">{formError}</div>}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Supplier *</label>
            <select
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              disabled={formMode === "edit"}
              className="ds-select"
            >
              <option value="">Select supplier…</option>
              {activeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.supplierCode} — {s.supplierName}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Item *</label>
            <select
              value={form.itemId}
              onChange={(e) => setForm({ ...form, itemId: e.target.value })}
              disabled={formMode === "edit"}
              className="ds-select"
            >
              <option value="">Select item…</option>
              {activeItems.map((i) => <option key={i.id} value={i.id}>{i.itemCode} — {i.itemName} ({i.uom})</option>)}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Unit Price (₹) *"
              type="number"
              min={0}
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
              placeholder="0.00"
            />
            <Input
              label="Tax %"
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={form.taxPercent}
              onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
              placeholder="18"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Lead Time (days)"
              type="number"
              min={0}
              step="1"
              value={form.leadTimeDays}
              onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
              placeholder="7"
            />
            <Input
              label="Min Order Qty"
              type="number"
              min={0}
              step="1"
              value={form.minOrderQty}
              onChange={(e) => setForm({ ...form, minOrderQty: e.target.value })}
              placeholder="1"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Effective From"
              type="date"
              value={form.effectiveFrom}
              onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            />
            <Input
              label="Effective To"
              type="date"
              value={form.effectiveTo}
              onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
            />
          </div>

          <Input
            label="Remarks"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            placeholder="Optional notes"
          />
        </div>
      </FormModal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete rate?"
        description={deletingRow ? `Remove the rate for ${deletingRow.supplierCode} × ${deletingRow.itemCode}?` : "Are you sure?"}
        confirmLabel="Delete"
        tone="danger"
        onClose={() => { if (!isMutating) { setConfirmOpen(false); setDeletingRow(null); } }}
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}
