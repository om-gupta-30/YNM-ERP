"use client";

import * as React from "react";
import type { Item, ItemType } from "@/lib/types";
import { itemService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { ItemForm, type ItemFormValues } from "@/components/items/ItemForm";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TableSkeleton } from "@/components/ui/DataTable";
import { TablePagination } from "@/components/ui/TablePagination";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useTableSort } from "@/lib/hooks/useTableSort";

type TypeFilter = ItemType | "ALL";

const itemTypeOptions: Array<{ value: TypeFilter; label: string }> = [
  { value: "ALL", label: "All types" },
  { value: "RAW_MATERIAL", label: "Raw Material" },
  { value: "SEMI_FINISHED", label: "Semi Finished" },
  { value: "FINISHED_GOOD", label: "Finished Good" },
  { value: "TRADING", label: "Trading" },
];

function matchesSearch(item: Item, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return (
    item.itemCode.toLowerCase().includes(query) ||
    item.itemName.toLowerCase().includes(query)
  );
}

export default function ItemsMasterPage() {
  const { role, currentUser } = useAuth();
  const { toast } = useToast();

  const canView = can.viewItems(role);
  const canEdit = can.editItems(role);

  const [items, setItems] = React.useState<Item[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("ALL");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = React.useState<Item | null>(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmItem, setConfirmItem] = React.useState<Item | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await itemService.getItems();
      setItems(list);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load items",
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
    const byType =
      typeFilter === "ALL" ? items : items.filter((i) => i.itemType === typeFilter);
    const bySearch = byType.filter((i) => matchesSearch(i, debouncedSearch));
    return bySearch;
  }, [items, debouncedSearch, typeFilter]);

  const getSortValue = React.useCallback((row: Item, key: string) => {
    if (key === "code") return row.itemCode;
    if (key === "name") return row.itemName;
    if (key === "type") return row.itemType;
    if (key === "uom") return row.uom;
    return "";
  }, []);
  const { sortConfig, onSort, sorted } = useTableSort(filtered, getSortValue);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter]);

  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  async function handleCreate(values: ItemFormValues) {
    setIsMutating(true);
    try {
      await itemService.createItem({
        itemCode: values.itemCode,
        itemName: values.itemName,
        itemType: values.itemType,
        category: values.category,
        uom: values.uom,
        hsnCode: values.hsnCode,
        reorderLevel: values.reorderLevel,
        isBomApplicable: values.isBomApplicable,
      }, { id: currentUser!.id, name: currentUser!.name });
      toast({ variant: "success", title: "Item created" });
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

  async function handleUpdate(values: ItemFormValues) {
    if (!editingItem) return;
    setIsMutating(true);
    try {
      await itemService.updateItem(editingItem.id, {
        itemCode: values.itemCode,
        itemName: values.itemName,
        itemType: values.itemType,
        category: values.category,
        uom: values.uom,
        hsnCode: values.hsnCode,
        reorderLevel: values.reorderLevel,
        isBomApplicable: values.isBomApplicable,
      }, { id: currentUser!.id, name: currentUser!.name });
      toast({ variant: "success", title: "Item updated" });
      setFormOpen(false);
      setEditingItem(null);
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

  function openCreate() {
    setFormMode("create");
    setEditingItem(null);
    setFormOpen(true);
  }

  function openEdit(item: Item) {
    setFormMode("edit");
    setEditingItem(item);
    setFormOpen(true);
  }

  function requestToggle(item: Item) {
    if (!item.isActive) {
      // activating doesn't require confirmation
      void doToggle(item);
      return;
    }
    setConfirmItem(item);
    setConfirmOpen(true);
  }

  async function doToggle(item: Item) {
    setIsMutating(true);
    try {
      await itemService.toggleItemStatus(item.id, { id: currentUser!.id, name: currentUser!.name });
      toast({
        variant: "success",
        title: item.isActive ? "Item deactivated" : "Item activated",
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
      setConfirmItem(null);
    }
  }

  if (!canView) {
    return (
      <AccessDenied
        title="Item Master"
        message="Only admin/planning/purchase roles can access Item Master."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Items"
        description="Create and maintain item master data."
        hint="Add your raw materials, semi-finished goods, and finished goods here. These are used everywhere in the ERP."
        actions={
          canEdit ? (
            <Button onClick={openCreate} disabled={isLoading || isMutating}>
              New Item
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
            placeholder="Search by item code or name"
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">
              Item Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as TypeFilter);
                setPage(1);
              }}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            >
              {itemTypeOptions.map((o) => (
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
            { header: "Item Code", accessor: "itemCode", sortKey: "code" },
            { header: "Name", accessor: "itemName", sortKey: "name" },
            {
              header: "Type",
              sortKey: "type",
              cell: (r) =>
                itemTypeOptions.find((x) => x.value === r.itemType)?.label ?? r.itemType,
            },
            { header: "UOM", accessor: "uom", sortKey: "uom" },
            {
              header: "Active Status",
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
          emptyState="No items found. Click 'New Item' above to add your first raw material or finished good."
        />
      )}

      <ItemForm
        open={formOpen}
        mode={formMode}
        initialItem={editingItem}
        existingItems={items}
        isSaving={isMutating}
        onClose={() => {
          if (isMutating) return;
          setFormOpen(false);
          setEditingItem(null);
        }}
        onSave={async (v) => {
          if (!canEdit) return;
          if (formMode === "create") await handleCreate(v);
          else await handleUpdate(v);
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate item?"
        description={
          confirmItem
            ? `Deactivating ${confirmItem.itemCode} will hide it from selection in future workflows.`
            : "Are you sure?"
        }
        confirmLabel="Deactivate"
        tone="danger"
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
          setConfirmItem(null);
        }}
        onConfirm={() => {
          if (!confirmItem) return;
          void doToggle(confirmItem);
        }}
      />
    </div>
  );
}

