"use client";

import * as React from "react";
import Link from "next/link";
import type { Item, WorkOrder } from "@/lib/types";
import { itemService, productionService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

export default function ProductionDashboardPage() {
  const { role, factory } = useAuth();
  const { toast } = useToast();

  const viewOk = can.viewProduction(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [items, setItems] = React.useState<Item[]>([]);
  const [workOrders, setWorkOrders] = React.useState<WorkOrder[]>([]);
  const [producedByWoId, setProducedByWoId] = React.useState<Record<string, number>>({});

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
        title: "Failed to load production dashboard",
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

  const itemById = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const active = workOrders.filter((w) => w.status === "OPEN" || w.status === "IN_PROGRESS");
  const completed = workOrders.filter((w) => w.status === "COMPLETED");
  const totalProduced = Object.values(producedByWoId).reduce((s, v) => s + v, 0);

  const fgSummary = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const wo of workOrders) {
      const produced = producedByWoId[wo.id] ?? 0;
      map[wo.finishedGoodItemId] = (map[wo.finishedGoodItemId] ?? 0) + produced;
    }
    return Object.entries(map)
      .map(([fgId, qty]) => ({
        id: fgId,
        fgId,
        fg: itemById.get(fgId)?.itemName ?? "—",
        code: itemById.get(fgId)?.itemCode ?? "—",
        qty,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [itemById, producedByWoId, workOrders]);

  if (!viewOk) {
    return (
      <AccessDenied
        title="Production Dashboard"
        message="Planning can create WOs. Stores issues materials. Production punches output. Admin has full view."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Dashboard"
        description="Live view of work orders and output summary."
        hint="See which work orders are running, total produced quantities, and FG output. Click a WO to issue materials or punch production."
        flowCurrent="/production/dashboard"
        flowNext={{ label: "Sales Orders", href: "/sales/orders" }}
        actions={
          <Link href="/production/work-orders">
            <Button variant="secondary">Work Orders</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active work orders" value={active.length} />
        <KpiCard label="Completed work orders" value={completed.length} />
        <KpiCard label="Total produced (FG)" value={totalProduced} />
        <KpiCard label="FGs with output" value={fgSummary.length} />
      </div>

      {isLoading ? (
        <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
          Loading dashboard…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="ds-filter-bar">
            <div className="text-sm font-semibold text-stone-950">Active work orders</div>
            <div className="mt-3 space-y-2">
              {active.slice(0, 6).map((wo) => (
                <div key={wo.id} className="flex items-center justify-between rounded-md bg-stone-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-stone-900">{wo.woNumber}</div>
                    <div className="truncate text-xs text-stone-500">
                      {itemById.get(wo.finishedGoodItemId)?.itemCode ?? "—"} • Planned {wo.quantityPlanned} • Produced {producedByWoId[wo.id] ?? 0}
                    </div>
                  </div>
                  <StatusBadge value={wo.status} />
                </div>
              ))}
            </div>
          </div>

          <div className="ds-filter-bar">
            <div className="text-sm font-semibold text-stone-950">FG output summary</div>
            <div className="mt-3">
              <DataTable
                rows={fgSummary}
                columns={[
                  { header: "FG Code", accessor: "code" },
                  { header: "FG Name", accessor: "fg" },
                  { header: "Produced", cell: (r) => String(r.qty), className: "text-right w-24" },
                ]}
                emptyState="No production output recorded."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

