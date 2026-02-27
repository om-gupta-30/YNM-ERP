"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BOM, Item } from "@/lib/types";
import { bomService, itemService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTableSort } from "@/lib/hooks/useTableSort";

type FgFilter = "ALL" | string;

export default function BomListPage() {
  const router = useRouter();
  const { role, currentUser } = useAuth();
  const { toast } = useToast();

  const canView = can.viewBOM(role);
  const canEdit = can.editBOM(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [boms, setBoms] = React.useState<BOM[]>([]);
  const [finishedGoods, setFinishedGoods] = React.useState<Item[]>([]);
  const [fgFilter, setFgFilter] = React.useState<FgFilter>("ALL");

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmBom, setConfirmBom] = React.useState<BOM | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [boms, items] = await Promise.all([
        bomService.getBOMs(),
        itemService.getItems(),
      ]);
      setBoms(boms);
      setFinishedGoods(items.filter((i) => i.isActive && i.itemType === "FINISHED_GOOD"));
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load BOMs",
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

  const fgById = React.useMemo(
    () => new Map(finishedGoods.map((i) => [i.id, i])),
    [finishedGoods],
  );

  const filtered = React.useMemo(() => {
    if (fgFilter === "ALL") return boms;
    return boms.filter((b) => b.finishedGoodItemId === fgFilter);
  }, [boms, fgFilter]);

  const getSortValue = React.useCallback((row: BOM, key: string) => {
    if (key === "code") return row.bomCode;
    if (key === "fg") return fgById.get(row.finishedGoodItemId)?.itemName ?? "";
    if (key === "version") return row.version;
    return "";
  }, [fgById]);
  const { sortConfig, onSort, sorted } = useTableSort(filtered, getSortValue);

  function requestDeactivate(bom: BOM) {
    setConfirmBom(bom);
    setConfirmOpen(true);
  }

  async function doDeactivate(bom: BOM) {
    setIsMutating(true);
    try {
      await bomService.deactivateBOM(bom.id, { id: currentUser!.id, name: currentUser!.name });
      toast({ variant: "success", title: "BOM deactivated" });
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Deactivate failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
      setConfirmOpen(false);
      setConfirmBom(null);
    }
  }

  if (!canView) {
    return (
      <AccessDenied
        title="BOM Master"
        message="Only admin/planning can manage BOMs. Production has view-only access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bill of Materials"
        description="Build and version Bill of Materials for finished goods."
        hint="A BOM defines what raw materials go into a finished good and how much of each. Used by work orders to calculate material requirements."
        actions={
          canEdit ? (
            <Button onClick={() => router.push("/masters/bom/new")} disabled={isLoading || isMutating}>
              New BOM
            </Button>
          ) : (
            <div className="text-sm text-stone-500">View only</div>
          )
        }
      />

      <div className="ds-filter-bar">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-sm font-medium text-stone-700">Filter by Finished Good</label>
            <select
              value={fgFilter}
              onChange={(e) => setFgFilter(e.target.value)}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            >
              <option value="ALL">All finished goods</option>
              {finishedGoods.map((fg) => (
                <option key={fg.id} value={fg.id}>
                  {fg.itemCode} — {fg.itemName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-between sm:justify-end">
            <div className="text-sm text-stone-600">
              Total: <span className="font-medium text-stone-900">{sorted.length}</span>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
          Loading BOMs…
        </div>
      ) : (
        <DataTable
          rows={sorted}
          sortConfig={sortConfig}
          onSort={onSort}
          columns={[
            { header: "BOM Code", accessor: "bomCode", sortKey: "code" },
            {
              header: "Finished Good Name",
              sortKey: "fg",
              cell: (r) => fgById.get(r.finishedGoodItemId)?.itemName ?? "—",
            },
            { header: "Version", sortKey: "version", cell: (r) => `v${r.version}`, className: "w-24" },
            {
              header: "Status",
              cell: (r) => <StatusBadge value={r.isActive ? "Active" : "Inactive"} />,
              className: "w-32",
            },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  <Link href={`/masters/bom/${r.id}`}>
                    <Button variant="secondary" size="sm">
                      View
                    </Button>
                  </Link>
                  {canEdit ? (
                    <Link href={`/masters/bom/${r.id}/edit`}>
                      <Button variant="secondary" size="sm" disabled={isMutating}>
                        New version
                      </Button>
                    </Link>
                  ) : null}
                  {canEdit ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => requestDeactivate(r)}
                      disabled={isMutating || !r.isActive}
                    >
                      Deactivate
                    </Button>
                  ) : null}
                </div>
              ),
              className: "text-right w-[280px]",
            },
          ]}
          emptyState="No BOMs yet. Click 'New BOM' to define what materials go into a finished good."
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate BOM?"
        description={
          confirmBom
            ? `Deactivating ${confirmBom.bomCode} v${confirmBom.version} will make it unavailable for production planning.`
            : "Are you sure?"
        }
        confirmLabel="Deactivate"
        tone="danger"
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
          setConfirmBom(null);
        }}
        onConfirm={() => {
          if (!confirmBom) return;
          void doDeactivate(confirmBom);
        }}
      />
    </div>
  );
}

