"use client";

import * as React from "react";
import type { Supplier } from "@/lib/types";
import { supplierService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { SupplierForm, type SupplierFormValues } from "@/components/suppliers/SupplierForm";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TableSkeleton } from "@/components/ui/DataTable";
import { TablePagination } from "@/components/ui/TablePagination";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useTableSort } from "@/lib/hooks/useTableSort";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active only" },
  { value: "INACTIVE", label: "Inactive only" },
];

function matchesSearch(s: Supplier, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return (
    s.supplierCode.toLowerCase().includes(query) ||
    s.supplierName.toLowerCase().includes(query)
  );
}

export default function SuppliersMasterPage() {
  const { role, currentUser } = useAuth();
  const { toast } = useToast();

  const canView = can.viewSuppliers(role);
  const canEdit = can.editSuppliers(role);

  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create");
  const [editingSupplier, setEditingSupplier] = React.useState<Supplier | null>(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmSupplier, setConfirmSupplier] = React.useState<Supplier | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await supplierService.getSuppliers();
      setSuppliers(list);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load suppliers",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!canView) return;
    void refresh();
  }, [canView, refresh]);

  const filtered = React.useMemo(() => {
    const byStatus =
      statusFilter === "ALL"
        ? suppliers
        : suppliers.filter((s) =>
            statusFilter === "ACTIVE" ? s.isActive : !s.isActive,
          );
    return byStatus.filter((s) => matchesSearch(s, debouncedSearch));
  }, [debouncedSearch, statusFilter, suppliers]);

  const getSortValue = React.useCallback((row: Supplier, key: string) => {
    if (key === "code") return row.supplierCode;
    if (key === "name") return row.supplierName;
    if (key === "gst") return row.gstNumber;
    return "";
  }, []);
  const { sortConfig, onSort, sorted } = useTableSort(filtered, getSortValue);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  function openCreate() {
    setFormMode("create");
    setEditingSupplier(null);
    setFormOpen(true);
  }

  function openEdit(s: Supplier) {
    setFormMode("edit");
    setEditingSupplier(s);
    setFormOpen(true);
  }

  async function handleCreate(values: SupplierFormValues) {
    setIsMutating(true);
    try {
      await supplierService.createSupplier(values, { id: currentUser!.id, name: currentUser!.name });
      toast({ variant: "success", title: "Supplier created" });
      setFormOpen(false);
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Create failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
    }
  }

  async function handleUpdate(values: SupplierFormValues) {
    if (!editingSupplier) return;
    setIsMutating(true);
    try {
      await supplierService.updateSupplier(editingSupplier.id, values, { id: currentUser!.id, name: currentUser!.name });
      toast({ variant: "success", title: "Supplier updated" });
      setFormOpen(false);
      setEditingSupplier(null);
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Update failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
    }
  }

  function requestToggle(s: Supplier) {
    if (!s.isActive) {
      void doToggle(s);
      return;
    }
    setConfirmSupplier(s);
    setConfirmOpen(true);
  }

  async function doToggle(s: Supplier) {
    setIsMutating(true);
    try {
      await supplierService.toggleSupplierStatus(s.id, { id: currentUser!.id, name: currentUser!.name });
      toast({
        variant: "success",
        title: s.isActive ? "Supplier deactivated" : "Supplier activated",
      });
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Action failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
      setConfirmOpen(false);
      setConfirmSupplier(null);
    }
  }

  if (!canView) {
    return (
      <AccessDenied
        title="Supplier Master"
        message="Only admin/purchase can manage suppliers. Planning has view-only access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Create and maintain supplier master data."
        hint="Add the vendors you buy materials from. You'll select them when sending RFQs and creating purchase orders."
        actions={
          canEdit ? (
            <Button onClick={openCreate} disabled={isLoading || isMutating}>
              New Supplier
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
            placeholder="Search by supplier code or name"
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
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
            { header: "Supplier Code", accessor: "supplierCode", sortKey: "code" },
            { header: "Name", accessor: "supplierName", sortKey: "name" },
            { header: "GST", accessor: "gstNumber", sortKey: "gst" },
            {
              header: "Contact",
              cell: (r) => (r.contactPerson ? `${r.contactPerson}${r.phone ? ` (${r.phone})` : ""}` : r.phone || "—"),
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(r)}
                      disabled={isMutating}
                    >
                      Edit
                    </Button>
                    <Button
                      variant={r.isActive ? "danger" : "primary"}
                      size="sm"
                      onClick={() => requestToggle(r)}
                      disabled={isMutating}
                    >
                      {r.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                ) : (
                  <div className="text-right text-sm text-stone-500">—</div>
                ),
              className: "text-right",
            },
          ]}
          emptyState="No suppliers found. Click 'New Supplier' above to add a vendor."
        />
      )}

      <SupplierForm
        open={formOpen}
        mode={formMode}
        initialSupplier={editingSupplier}
        existingSuppliers={suppliers}
        isSaving={isMutating}
        onClose={() => {
          if (isMutating) return;
          setFormOpen(false);
          setEditingSupplier(null);
        }}
        onSave={async (v) => {
          if (!canEdit) return;
          if (formMode === "create") await handleCreate(v);
          else await handleUpdate(v);
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate supplier?"
        description={
          confirmSupplier
            ? `Deactivating ${confirmSupplier.supplierCode} will hide it from selection in future workflows.`
            : "Are you sure?"
        }
        confirmLabel="Deactivate"
        tone="danger"
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
          setConfirmSupplier(null);
        }}
        onConfirm={() => {
          if (!confirmSupplier) return;
          void doToggle(confirmSupplier);
        }}
      />
    </div>
  );
}

