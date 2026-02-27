"use client";

import * as React from "react";
import type { Customer } from "@/lib/types";
import { customerService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { CustomerForm, type CustomerFormValues } from "@/components/customers/CustomerForm";
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

function matchesSearch(c: Customer, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return (
    c.customerCode.toLowerCase().includes(query) ||
    c.customerName.toLowerCase().includes(query)
  );
}

export default function CustomersMasterPage() {
  const { role, currentUser } = useAuth();
  const { toast } = useToast();

  const canView = can.viewCustomers(role);
  const canEdit = can.editCustomers(role);

  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create");
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmCustomer, setConfirmCustomer] = React.useState<Customer | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await customerService.getCustomers();
      setCustomers(list);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load customers",
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
        ? customers
        : customers.filter((c) =>
            statusFilter === "ACTIVE" ? c.isActive : !c.isActive,
          );
    return byStatus.filter((c) => matchesSearch(c, debouncedSearch));
  }, [customers, debouncedSearch, statusFilter]);

  const getSortValue = React.useCallback((row: Customer, key: string) => {
    if (key === "code") return row.customerCode;
    if (key === "name") return row.customerName;
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
    setEditingCustomer(null);
    setFormOpen(true);
  }

  function openEdit(c: Customer) {
    setFormMode("edit");
    setEditingCustomer(c);
    setFormOpen(true);
  }

  async function handleCreate(values: CustomerFormValues) {
    setIsMutating(true);
    try {
      await customerService.createCustomer(values, { id: currentUser!.id, name: currentUser!.name });
      toast({ variant: "success", title: "Customer created" });
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

  async function handleUpdate(values: CustomerFormValues) {
    if (!editingCustomer) return;
    setIsMutating(true);
    try {
      await customerService.updateCustomer(editingCustomer.id, values, { id: currentUser!.id, name: currentUser!.name });
      toast({ variant: "success", title: "Customer updated" });
      setFormOpen(false);
      setEditingCustomer(null);
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

  function requestToggle(c: Customer) {
    if (!c.isActive) {
      void doToggle(c);
      return;
    }
    setConfirmCustomer(c);
    setConfirmOpen(true);
  }

  async function doToggle(c: Customer) {
    setIsMutating(true);
    try {
      await customerService.toggleCustomerStatus(c.id, { id: currentUser!.id, name: currentUser!.name });
      toast({
        variant: "success",
        title: c.isActive ? "Customer deactivated" : "Customer activated",
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
      setConfirmCustomer(null);
    }
  }

  if (!canView) {
    return (
      <AccessDenied
        title="Customer Master"
        message="Only admin/sales can manage customers. Accounts has view-only access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Create and maintain customer master data."
        hint="Add the companies you sell to. You'll select them when creating sales orders."
        actions={
          canEdit ? (
            <Button onClick={openCreate} disabled={isLoading || isMutating}>
              New Customer
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
            placeholder="Search by customer code or name"
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
            { header: "Customer Code", accessor: "customerCode", sortKey: "code" },
            { header: "Name", accessor: "customerName", sortKey: "name" },
            { header: "GST", accessor: "gstNumber", sortKey: "gst" },
            {
              header: "Contact",
              cell: (r) =>
                r.contactPerson
                  ? `${r.contactPerson}${r.phone ? ` (${r.phone})` : ""}`
                  : r.phone || "—",
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
          emptyState="No customers found. Click 'New Customer' above to add one."
        />
      )}

      <CustomerForm
        open={formOpen}
        mode={formMode}
        initialCustomer={editingCustomer}
        existingCustomers={customers}
        isSaving={isMutating}
        onClose={() => {
          if (isMutating) return;
          setFormOpen(false);
          setEditingCustomer(null);
        }}
        onSave={async (v) => {
          if (!canEdit) return;
          if (formMode === "create") await handleCreate(v);
          else await handleUpdate(v);
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate customer?"
        description={
          confirmCustomer
            ? `Deactivating ${confirmCustomer.customerCode} will hide it from selection in future workflows.`
            : "Are you sure?"
        }
        confirmLabel="Deactivate"
        tone="danger"
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
          setConfirmCustomer(null);
        }}
        onConfirm={() => {
          if (!confirmCustomer) return;
          void doToggle(confirmCustomer);
        }}
      />
    </div>
  );
}

