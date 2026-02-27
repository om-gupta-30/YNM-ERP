"use client";

import * as React from "react";
import Link from "next/link";
import type { GateEntry } from "@/lib/types";
import { inventoryService, prService, supplierService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { useTableSort } from "@/lib/hooks/useTableSort";

export default function GateEntryPage() {
  const { role, factory, currentUser } = useAuth();
  const { toast } = useToast();

  const viewOk = can.viewGateEntry(role);
  const canCreate = can.createGateEntry(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [entries, setEntries] = React.useState<GateEntry[]>([]);

  const [openPOs, setOpenPOs] = React.useState<Array<{ id: string; poNumber: string; supplierId: string; status: string }>>([]);
  const [supplierById, setSupplierById] = React.useState<Map<string, { supplierCode: string; supplierName: string }>>(new Map());
  const [poById, setPoById] = React.useState<Map<string, { poNumber: string }>>(new Map());

  const [poId, setPoId] = React.useState("");
  const [vehicleNumber, setVehicleNumber] = React.useState("");
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [ewayBillNumber, setEwayBillNumber] = React.useState("");

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [entries, pos, openPos, suppliers] = await Promise.all([
        inventoryService.getGateEntries({ factory: factory ?? "YNM-HYD" }),
        prService.getPOs({ factory: factory ?? "YNM-HYD" }),
        inventoryService.getOpenPOs({ factory: factory ?? "YNM-HYD" }),
        supplierService.getSuppliers(),
      ]);
      setEntries(entries);
      setOpenPOs(openPos);
      setSupplierById(new Map(suppliers.map((s) => [s.id, { supplierCode: s.supplierCode, supplierName: s.supplierName }])));
      setPoById(new Map(pos.map((p) => [p.id, { poNumber: p.poNumber }])));
      setPoId((prev) => prev || openPos[0]?.id || "");
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load gate entries",
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

  const getSortValue = React.useCallback((row: GateEntry, key: string) => {
    switch (key) {
      case "number": return row.gateEntryNumber;
      case "vehicle": return row.vehicleNumber;
      case "status": return row.status;
      case "date": return row.createdAt;
      default: return "";
    }
  }, []);

  const { sortConfig, onSort, sorted } = useTableSort(entries, getSortValue);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setIsSaving(true);
    try {
      await inventoryService.createGateEntry({
        poId,
        vehicleNumber,
        invoiceNumber,
        ewayBillNumber,
        factory: factory ?? "YNM-HYD",
      }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "Gate entry created" });
      setVehicleNumber("");
      setInvoiceNumber("");
      setEwayBillNumber("");
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Create failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (!viewOk) {
    return (
      <AccessDenied
        title="Gate Entry"
        message="Stores has full access. Security can create gate entries only. Purchase has view-only access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gate Entry"
        description="Record inbound vehicle and invoice details against a PO."
        hint="When a supplier's truck arrives at the factory gate, log it here with the vehicle and invoice details."
        flowCurrent="/inventory/gate-entry"
        flowNext={{ label: "GRN", href: "/inventory/grn" }}
      />

      {canCreate ? (
        <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm">
          <div className="text-sm font-semibold text-stone-950">Create gate entry</div>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={onCreate}>
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-sm font-medium text-stone-700">PO</label>
              <select
                value={poId}
                onChange={(e) => setPoId(e.target.value)}
                className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
                required
              >
                <option value="">Select PO…</option>
                {openPOs.map((p) => {
                  const s = supplierById.get(p.supplierId);
                  const sup = s ? `${s.supplierCode} — ${s.supplierName}` : "—";
                  return (
                    <option key={p.id} value={p.id}>
                      {p.poNumber} • {sup} • {p.status}
                    </option>
                  );
                })}
              </select>
              <div className="text-xs text-stone-500">Open/Partial POs: {openPOs.length}</div>
            </div>

            <Input
              label="Vehicle number"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="e.g. MH12AB1234"
              required
            />
            <Input
              label="Invoice number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Supplier invoice"
              required
            />
            <Input
              label="E-way bill number"
              value={ewayBillNumber}
              onChange={(e) => setEwayBillNumber(e.target.value)}
              placeholder="Optional"
            />

            <div className="flex items-end justify-end gap-2 sm:col-span-2">
              <Button type="submit" disabled={isSaving || !poId}>
                {isSaving ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="text-sm text-stone-500">View only</div>
      )}

      {isLoading ? (
        <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
          Loading gate entries…
        </div>
      ) : (
        <DataTable
          rows={sorted}
          sortConfig={sortConfig}
          onSort={onSort}
          columns={[
            { header: "Gate Entry No.", accessor: "gateEntryNumber", sortKey: "number" },
            { header: "PO", cell: (r) => poById.get(r.poId)?.poNumber ?? "—" },
            {
              header: "Supplier",
              cell: (r) => {
                const s = supplierById.get(r.supplierId);
                return s ? `${s.supplierCode} — ${s.supplierName}` : "—";
              },
            },
            { header: "Vehicle", accessor: "vehicleNumber", sortKey: "vehicle" },
            { header: "Invoice", accessor: "invoiceNumber" },
            { header: "Status", cell: (r) => <StatusBadge value={r.status} />, className: "w-24", sortKey: "status" },
            { header: "Created", cell: (r) => new Date(r.createdAt).toLocaleString(), className: "w-44", sortKey: "date" },
            {
              header: "Actions",
              cell: () => (
                <div className="flex justify-end">
                  <Link href="/inventory/grn">
                    <Button variant="secondary" size="sm">
                      GRN
                    </Button>
                  </Link>
                </div>
              ),
              className: "text-right w-24",
            },
          ]}
          emptyState="No gate entries yet. When a supplier truck arrives, create one above."
        />
      )}
    </div>
  );
}

