"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { PurchaseOrder, Supplier } from "@/lib/types";
import { prService, supplierService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

export default function PoDetailPage() {
  const params = useParams<{ id: string }>();
  const poId = params.id;

  const { role, factory } = useAuth();
  const { toast } = useToast();

  const canView = can.viewPO(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [po, setPo] = React.useState<PurchaseOrder | null>(null);
  const [supplier, setSupplier] = React.useState<Supplier | null>(null);
  const [comparison, setComparison] = React.useState<Awaited<ReturnType<typeof prService.getComparisonData>> | null>(null);

  React.useEffect(() => {
    if (!canView) return;
    setIsLoading(true);
    Promise.all([prService.getPOById(poId), supplierService.getSuppliers()])
      .then(async ([po, suppliers]) => {
        setPo(po);
        if (!po) return;
        setSupplier(suppliers.find((s) => s.id === po.supplierId) ?? null);
        const rfq = await prService.getRFQById(po.linkedRfqId);
        if (!rfq) return;
        const cmp = await prService.getComparisonData(rfq.id);
        setComparison(cmp);
      })
      .catch((err) => {
        toast({
          variant: "error",
          title: "Failed to load PO",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      })
      .finally(() => setIsLoading(false));
  }, [canView, poId, toast]);

  if (!canView) {
    return (
      <AccessDenied
        title="Purchase Order"
        message="Purchase has full RFQ/PO access. Planning can view only. Admin can approve and view."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading PO…
      </div>
    );
  }

  if (!po) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        PO not found.
      </div>
    );
  }

  if (factory && po.factory && po.factory !== factory) {
    return <AccessDenied title="Factory scoped" message="This PO belongs to a different factory." />;
  }

  const lines = comparison
    ? comparison.lines.map((l) => {
        const cell = l.perSupplier.find((p) => p.supplierId === po.supplierId);
        return {
          id: l.prItemId,
          itemId: l.itemId,
          item: `${l.itemCode} — ${l.itemName}`,
          qty: l.quantity,
          uom: l.uom,
          unitPrice: cell?.unitPrice ?? null,
          taxPercent: cell?.taxPercent ?? null,
          landedUnit: cell?.landedUnit ?? null,
          lineTotal: cell?.lineTotal ?? null,
          deliveryDays: cell?.deliveryDays ?? null,
        };
      })
    : [];

  const grandTotal = lines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={po.poNumber}
        description={
          supplier
            ? `${supplier.supplierCode} — ${supplier.supplierName}`
            : "Supplier: —"
        }
        actions={
          <div className="flex gap-2">
            <Link href="/purchase/po">
              <Button variant="secondary">Back</Button>
            </Link>
            <Link href={`/purchase/rfq/${po.linkedRfqId}/comparison`}>
              <Button variant="secondary">View RFQ</Button>
            </Link>
          </div>
        }
      />

      <div className="ds-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
          <StatusBadge value={po.status} />
          <div className="text-stone-400">•</div>
          <div className="text-stone-500">
            Created: <span className="text-stone-700">{new Date(po.createdAt).toLocaleString()}</span>
          </div>
          <div className="text-stone-400">•</div>
          <div>
            Items: <span className="font-medium text-stone-900">{lines.length}</span>
          </div>
        </div>
      </div>

      <DataTable
        rows={lines}
        columns={[
          { header: "Item", accessor: "item" },
          { header: "Qty", cell: (r) => `${r.qty} ${r.uom}`, className: "text-right w-28" },
          {
            header: "Unit",
            cell: (r) => (r.unitPrice == null ? "—" : r.unitPrice.toFixed(2)),
            className: "text-right w-24",
          },
          {
            header: "Tax %",
            cell: (r) => (r.taxPercent == null ? "—" : r.taxPercent.toFixed(1)),
            className: "text-right w-20",
          },
          {
            header: "Landed",
            cell: (r) => (r.landedUnit == null ? "—" : r.landedUnit.toFixed(2)),
            className: "text-right w-24",
          },
          {
            header: "Total",
            cell: (r) => (r.lineTotal == null ? "—" : r.lineTotal.toFixed(2)),
            className: "text-right w-28",
          },
          {
            header: "Delivery (d)",
            cell: (r) => (r.deliveryDays == null ? "—" : String(r.deliveryDays)),
            className: "text-right w-28",
          },
        ]}
        emptyState="No PO lines available (quotes missing)."
      />

      <div className="ds-surface p-4 text-sm text-stone-700">
        <div className="flex justify-end">
          <div className="text-right">
            <div className="text-stone-500">Grand total</div>
            <div className="text-lg font-semibold text-stone-950">{grandTotal.toFixed(2)}</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-stone-500">
          Note: Totals are computed from the selected supplier’s quote in the linked RFQ .
        </div>
      </div>
    </div>
  );
}

