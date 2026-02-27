"use client";

import * as React from "react";
import Link from "next/link";
import type { PurchaseOrder } from "@/lib/types";
import { prService, supplierService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { useTableSort } from "@/lib/hooks/useTableSort";

export default function PoListPage() {
  const { role, factory } = useAuth();
  const { toast } = useToast();

  const canView = can.viewPO(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [pos, setPos] = React.useState<PurchaseOrder[]>([]);
  const [supplierById, setSupplierById] = React.useState<Map<string, { supplierName: string; supplierCode: string }>>(new Map());
  const [rfqById, setRfqById] = React.useState<Map<string, { rfqNumber: string }>>(new Map());

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [pos, suppliers, rfqs] = await Promise.all([
        prService.getPOs({ factory: factory ?? "YNM-HYD" }),
        supplierService.getSuppliers(),
        prService.getRFQs({ factory: factory ?? "YNM-HYD" }),
      ]);
      setPos(pos);
      setSupplierById(new Map(suppliers.map((s) => [s.id, { supplierName: s.supplierName, supplierCode: s.supplierCode }])));
      setRfqById(new Map(rfqs.map((r) => [r.id, { rfqNumber: r.rfqNumber }])));
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load POs",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [factory, toast]);

  React.useEffect(() => {
    if (!canView) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, factory]);

  const getSortValue = React.useCallback((row: PurchaseOrder, key: string) => {
    switch (key) {
      case "number": return row.poNumber;
      case "date": return row.createdAt;
      case "status": return row.status;
      default: return "";
    }
  }, []);

  const { sortConfig, onSort, sorted } = useTableSort(pos, getSortValue);

  if (!canView) {
    return (
      <AccessDenied
        title="Purchase Orders"
        message="Purchase has full RFQ/PO access. Planning can view only. Admin can approve and view."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Purchase orders generated from approved RFQs."
        hint="These are confirmed orders sent to suppliers. Once goods arrive at the gate, move to Gate Entry."
        flowCurrent="/purchase/po"
        flowNext={{ label: "Gate Entry", href: "/inventory/gate-entry" }}
      />

      {isLoading ? (
        <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
          Loading POs…
        </div>
      ) : (
        <DataTable
          rows={sorted}
          sortConfig={sortConfig}
          onSort={onSort}
          columns={[
            {
              header: "PO No",
              sortKey: "number",
              cell: (r) => (
                <Link href={`/purchase/po/${r.id}`} className="font-medium text-stone-900 hover:underline">
                  {r.poNumber}
                </Link>
              ),
            },
            {
              header: "Supplier",
              cell: (r) => {
                const s = supplierById.get(r.supplierId);
                return s ? `${s.supplierCode} — ${s.supplierName}` : "—";
              },
            },
            {
              header: "Linked RFQ",
              cell: (r) => rfqById.get(r.linkedRfqId)?.rfqNumber ?? "—",
            },
            {
              header: "Created",
              sortKey: "date",
              cell: (r) => new Date(r.createdAt).toLocaleString(),
            },
            {
              header: "Status",
              sortKey: "status",
              cell: (r) => <StatusBadge value={r.status} />,
              className: "w-28",
            },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex justify-end">
                  <Link href={`/purchase/po/${r.id}`}>
                    <Button variant="secondary" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              ),
              className: "text-right w-28",
            },
          ]}
          emptyState="No purchase orders yet. POs are generated from the RFQ comparison page."
        />
      )}
    </div>
  );
}

