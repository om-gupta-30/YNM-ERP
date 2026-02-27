"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GRN, GateEntry } from "@/lib/types";
import { inventoryService, prService, supplierService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { useTableSort } from "@/lib/hooks/useTableSort";

export default function GrnListPage() {
  const router = useRouter();
  const { role, factory, currentUser } = useAuth();
  const { toast } = useToast();

  const viewOk = can.viewGRN(role);
  const canCreate = can.createGRN(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [grns, setGrns] = React.useState<GRN[]>([]);
  const [gateEntries, setGateEntries] = React.useState<GateEntry[]>([]);

  const [selectedGateEntryId, setSelectedGateEntryId] = React.useState<string>("");

  const [poById, setPoById] = React.useState<Map<string, { poNumber: string }>>(new Map());
  const [supplierById, setSupplierById] = React.useState<Map<string, { supplierCode: string; supplierName: string }>>(new Map());
  const [gateById, setGateById] = React.useState<Map<string, GateEntry>>(new Map());

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [grns, gates, pos, suppliers] = await Promise.all([
        inventoryService.getGRNs({ factory: factory ?? "YNM-HYD" }),
        inventoryService.getGateEntries({ factory: factory ?? "YNM-HYD" }),
        prService.getPOs({ factory: factory ?? "YNM-HYD" }),
        supplierService.getSuppliers(),
      ]);
      setGrns(grns);
      setGateEntries(gates);
      setPoById(new Map(pos.map((p) => [p.id, { poNumber: p.poNumber }])));
      setSupplierById(
        new Map(suppliers.map((s) => [s.id, { supplierCode: s.supplierCode, supplierName: s.supplierName }])),
      );
      setGateById(new Map(gates.map((g) => [g.id, g])));
      setSelectedGateEntryId((prev) => prev || gates.find((g) => g.status === "OPEN")?.id || "");
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load GRNs",
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

  const getSortValue = React.useCallback((row: GRN, key: string) => {
    switch (key) {
      case "number": return row.grnNumber;
      case "status": return row.status;
      case "date": return row.createdAt;
      default: return "";
    }
  }, []);

  const { sortConfig, onSort, sorted } = useTableSort(grns, getSortValue);

  const openGateEntries = gateEntries.filter((g) => g.status === "OPEN");

  async function onCreate() {
    if (!canCreate) return;
    if (!selectedGateEntryId) return;
    setIsMutating(true);
    try {
      const grn = await inventoryService.createGRN({ gateEntryId: selectedGateEntryId }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "GRN created" });
      router.push(`/inventory/grn/${grn.id}`);
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

  if (!viewOk) {
    return (
      <AccessDenied
        title="GRN"
        message="Stores has full access. Purchase has view-only access. Other roles have no access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Receipt Note (GRN)"
        description="Create GRNs against gate entries and update stock ledger."
        hint="Inspect the received goods, record accepted and rejected quantities. Approving a GRN updates your stock."
        flowCurrent="/inventory/grn"
        flowNext={{ label: "Work Orders", href: "/production/work-orders" }}
      />

      {canCreate ? (
        <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm space-y-3">
          <div className="text-sm font-semibold text-stone-950">New GRN</div>
          <div className="text-sm text-stone-600">
            Select an open gate entry to create a draft GRN.
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-sm font-medium text-stone-700">Gate entry</label>
              <select
                value={selectedGateEntryId}
                onChange={(e) => setSelectedGateEntryId(e.target.value)}
                className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
              >
                <option value="">Select gate entry…</option>
                {openGateEntries.map((g) => {
                  const po = poById.get(g.poId)?.poNumber ?? "—";
                  const sup = supplierById.get(g.supplierId);
                  const supLabel = sup ? `${sup.supplierCode} — ${sup.supplierName}` : "—";
                  return (
                    <option key={g.id} value={g.id}>
                      {g.gateEntryNumber} • {po} • {supLabel}
                    </option>
                  );
                })}
              </select>
              <div className="text-xs text-stone-500">
                Open gate entries: {openGateEntries.length}
              </div>
            </div>
            <div className="flex items-end justify-end gap-2">
              <Button onClick={() => void onCreate()} disabled={!selectedGateEntryId || isMutating}>
                {isMutating ? "Creating…" : "Create GRN"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
          Loading GRNs…
        </div>
      ) : (
        <DataTable
          rows={sorted}
          sortConfig={sortConfig}
          onSort={onSort}
          columns={[
            {
              header: "GRN No.",
              sortKey: "number",
              cell: (r) => (
                <Link href={`/inventory/grn/${r.id}`} className="font-medium text-stone-900 hover:underline">
                  {r.grnNumber}
                </Link>
              ),
            },
            {
              header: "Gate Entry",
              cell: (r) => gateById.get(r.gateEntryId)?.gateEntryNumber ?? "—",
            },
            {
              header: "PO",
              cell: (r) => poById.get(r.poId)?.poNumber ?? "—",
            },
            {
              header: "Supplier",
              cell: (r) => {
                const gate = gateById.get(r.gateEntryId);
                const sup = gate ? supplierById.get(gate.supplierId) : null;
                return sup ? `${sup.supplierCode} — ${sup.supplierName}` : "—";
              },
            },
            {
              header: "Status",
              sortKey: "status",
              cell: (r) => <StatusBadge value={r.status} />,
              className: "w-28",
            },
            {
              header: "Created",
              sortKey: "date",
              cell: (r) => new Date(r.createdAt).toLocaleString(),
              className: "w-44",
            },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex justify-end">
                  <Link href={`/inventory/grn/${r.id}`}>
                    <Button variant="secondary" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              ),
              className: "text-right w-24",
            },
          ]}
          emptyState="No GRNs yet. Create one from a gate entry to inspect and accept received goods."
        />
      )}
    </div>
  );
}

