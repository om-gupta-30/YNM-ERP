"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Item, WorkOrder } from "@/lib/types";
import { itemService, productionService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

export default function ProductionPunchPage() {
  const params = useParams<{ id: string }>();
  const workOrderId = params.id;

  const { role, factory, currentUser } = useAuth();
  const { toast } = useToast();

  const viewOk = can.viewProduction(role);
  const canPunch = can.punchProduction(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [wo, setWo] = React.useState<WorkOrder | null>(null);
  const [itemsById, setItemsById] = React.useState<Map<string, Item>>(new Map());
  const [producedTotal, setProducedTotal] = React.useState(0);
  const [scrapTotal, setScrapTotal] = React.useState(0);

  const [qtyProduced, setQtyProduced] = React.useState<number>(0);
  const [qtyScrap, setQtyScrap] = React.useState<number>(0);

  const [confirmCompleteOpen, setConfirmCompleteOpen] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [wo, items, punches] = await Promise.all([
        productionService.getWorkOrderById(workOrderId),
        itemService.getItems(),
        productionService.getProductionPunches(workOrderId),
      ]);
      setWo(wo);
      setItemsById(new Map(items.map((i) => [i.id, i])));
      setProducedTotal(punches.reduce((s, p) => s + p.quantityProduced, 0));
      setScrapTotal(punches.reduce((s, p) => s + p.scrapQuantity, 0));
      setQtyProduced(0);
      setQtyScrap(0);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load punching",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, workOrderId]);

  React.useEffect(() => {
    if (!viewOk) return;
    void refresh();
  }, [refresh, viewOk]);

  async function onPunch() {
    if (!wo) return;
    setIsMutating(true);
    try {
      await productionService.punchProduction({
        workOrderId: wo.id,
        quantityProduced: qtyProduced,
        scrapQuantity: qtyScrap,
      }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "Punch recorded" });
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Punch failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
    }
  }

  async function onComplete() {
    if (!wo) return;
    setIsMutating(true);
    try {
      await productionService.completeWorkOrder(wo.id, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "Work order completed" });
      setConfirmCompleteOpen(false);
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Complete failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
    }
  }

  if (!viewOk) {
    return (
      <AccessDenied
        title="Production Punch"
        message="Production punches output. Planning creates WOs. Stores issues materials. Admin has full view."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading punching…
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

  const fg = itemsById.get(wo.finishedGoodItemId);
  const pct = wo.quantityPlanned > 0 ? Math.min((producedTotal / wo.quantityPlanned) * 100, 100) : 0;
  const isComplete = wo.status === "COMPLETED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Punch — ${wo.woNumber}`}
        description={fg ? `${fg.itemCode} — ${fg.itemName} • Planned ${wo.quantityPlanned}` : `Planned ${wo.quantityPlanned}`}
        actions={
          <div className="flex gap-2">
            <Link href="/production/work-orders">
              <Button variant="secondary">Back</Button>
            </Link>
            <Link href={`/production/issue/${wo.id}`}>
              <Button variant="secondary">Issue</Button>
            </Link>
            {canPunch && !isComplete ? (
              <>
                <Button onClick={() => void onPunch()} disabled={isMutating}>
                  {isMutating ? "Saving…" : "Save punch"}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmCompleteOpen(true)} disabled={isMutating}>
                  Complete
                </Button>
              </>
            ) : (
              <div className="text-sm text-stone-500 self-center">{isComplete ? "Completed" : "View only"}</div>
            )}
          </div>
        }
      />

      <div className="ds-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
          <StatusBadge value={wo.status} />
          <div className="text-stone-400">•</div>
          <div>
            Produced: <span className="font-medium text-stone-900">{producedTotal}</span>
          </div>
          <div className="text-stone-400">•</div>
          <div>
            Scrap: <span className="font-medium text-stone-900">{scrapTotal}</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-stone-600">
            <span>Progress</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-stone-100 border border-stone-200">
            <div className="h-2 rounded-full bg-stone-900" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-900 text-sm font-semibold text-white">
            3
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-stone-950">Production punch</div>
            <div className="text-sm text-stone-600">
              Enter produced and scrap quantities for this punch.
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700">Produced quantity</label>
            <input
              type="number"
              min={0}
              step="1"
              disabled={!canPunch || isComplete}
              value={String(qtyProduced)}
              onChange={(e) => setQtyProduced(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Scrap quantity</label>
            <input
              type="number"
              min={0}
              step="1"
              disabled={!canPunch || isComplete}
              value={String(qtyScrap)}
              onChange={(e) => setQtyScrap(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCompleteOpen}
        title="Complete work order?"
        description="Completion is allowed only when produced quantity meets or exceeds planned quantity."
        confirmLabel="Complete"
        onClose={() => {
          if (isMutating) return;
          setConfirmCompleteOpen(false);
        }}
        onConfirm={() => void onComplete()}
      />
    </div>
  );
}

