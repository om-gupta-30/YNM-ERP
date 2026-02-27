"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Item, ProductionIssue, WorkOrder } from "@/lib/types";
import { inventoryService, itemService, productionService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

export default function MaterialIssuePage() {
  const params = useParams<{ id: string }>();
  const workOrderId = params.id;

  const { role, factory, currentUser } = useAuth();
  const { toast } = useToast();

  const viewOk = can.viewProduction(role);
  const canIssue = can.issueMaterials(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [wo, setWo] = React.useState<WorkOrder | null>(null);
  const [itemsById, setItemsById] = React.useState<Map<string, Item>>(new Map());
  const [required, setRequired] = React.useState<Array<{ itemId: string; requiredQty: number }>>([]);
  const [issued, setIssued] = React.useState<ProductionIssue[]>([]);
  const [stock, setStock] = React.useState<Record<string, number>>({});

  const [draftIssue, setDraftIssue] = React.useState<Record<string, number>>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [wo, items, req, iss, stock] = await Promise.all([
        productionService.getWorkOrderById(workOrderId),
        itemService.getItems(),
        productionService.getRequiredMaterials(workOrderId),
        productionService.getProductionIssues(workOrderId),
        inventoryService.getCurrentStock({ factory: factory ?? "YNM-HYD" }),
      ]);
      setWo(wo);
      setItemsById(new Map(items.map((i) => [i.id, i])));
      setRequired(req.required.map((r) => ({ itemId: r.itemId, requiredQty: r.requiredQty })));
      setIssued(iss);
      setStock(stock);
      setDraftIssue({});
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load material issue",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [factory, toast, workOrderId]);

  React.useEffect(() => {
    if (!viewOk) return;
    void refresh();
  }, [refresh, viewOk]);

  const issuedByItem = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of issued) map[i.itemId] = (map[i.itemId] ?? 0) + i.quantityIssued;
    return map;
  }, [issued]);

  const rows = React.useMemo(() => {
    return required.map((r) => {
      const it = itemsById.get(r.itemId);
      const issuedQty = issuedByItem[r.itemId] ?? 0;
      const available = stock[r.itemId] ?? 0;
      const remaining = Math.max(r.requiredQty - issuedQty, 0);
      return {
        id: r.itemId,
        itemId: r.itemId,
        item: it ? `${it.itemCode} — ${it.itemName}` : "—",
        uom: it?.uom ?? "—",
        requiredQty: r.requiredQty,
        issuedQty,
        remaining,
        available,
      };
    });
  }, [issuedByItem, itemsById, required, stock]);

  async function doIssue() {
    if (!wo) return;
    const lines = Object.entries(draftIssue)
      .map(([itemId, qty]) => ({ itemId, quantityIssued: Number(qty) }))
      .filter((l) => l.itemId && Number.isFinite(l.quantityIssued) && l.quantityIssued > 0);

    if (lines.length === 0) {
      toast({ variant: "error", title: "Enter issued quantity for at least one item" });
      return;
    }

    setIsMutating(true);
    try {
      await productionService.issueMaterials({ workOrderId: wo.id, issues: lines }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "Materials issued and stock updated" });
      setConfirmOpen(false);
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Issue failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
    }
  }

  if (!viewOk) {
    return (
      <AccessDenied
        title="Material Issue"
        message="Stores can issue materials. Planning creates WOs. Production punches output. Admin has full view."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading material issue…
      </div>
    );
  }

  if (!wo) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Work order not found.
      </div>
    );
  }

  if (factory && wo.factory && wo.factory !== factory) {
    return <AccessDenied title="Factory scoped" message="This work order belongs to a different factory." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Material Issue — ${wo.woNumber}`}
        description="Issue materials as per BOM requirement. Posts OUTWARD stock ledger entries."
        actions={
          <div className="flex gap-2">
            <Link href="/production/work-orders">
              <Button variant="secondary">Back</Button>
            </Link>
            <Link href={`/production/punch/${wo.id}`}>
              <Button variant="secondary">Punch</Button>
            </Link>
            {canIssue ? (
              <Button onClick={() => setConfirmOpen(true)} disabled={isMutating}>
                Issue materials
              </Button>
            ) : (
              <div className="text-sm text-stone-500 self-center">View only</div>
            )}
          </div>
        }
      />

      <div className="ds-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
          <StatusBadge value={wo.status} />
          <div className="text-stone-400">•</div>
          <div>
            Planned: <span className="font-medium text-stone-900">{wo.quantityPlanned}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-900 text-sm font-semibold text-white">
            2
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-stone-950">BOM materials</div>
            <div className="text-sm text-stone-600">
              Required vs issued and current stock availability.
            </div>
          </div>
        </div>

        <div className="mt-4">
          <DataTable
            rows={rows}
            columns={[
              { header: "Material", accessor: "item" },
              { header: "UOM", accessor: "uom", className: "w-20" },
              { header: "Required", cell: (r) => r.requiredQty.toFixed(3).replace(/\.?0+$/, ""), className: "text-right w-28" },
              { header: "Issued", cell: (r) => r.issuedQty.toFixed(3).replace(/\.?0+$/, ""), className: "text-right w-28" },
              { header: "Available", cell: (r) => String(r.available), className: "text-right w-28" },
              { header: "Issue now", cell: (r) => (
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  disabled={!canIssue}
                  value={String(draftIssue[r.itemId] ?? 0)}
                  onChange={(e) => setDraftIssue((p) => ({ ...p, [r.itemId]: Number(e.target.value) }))}
                  className="h-9 w-28 rounded-md bg-white px-3 text-right text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
                />
              ), className: "text-right w-36" },
            ]}
            emptyState="No BOM materials."
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm material issue?"
        description="This will post OUTWARD stock ledger entries for the issued quantities."
        confirmLabel="Issue"
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
        }}
        onConfirm={() => void doIssue()}
      />
    </div>
  );
}

