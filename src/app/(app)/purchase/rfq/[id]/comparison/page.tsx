"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { prService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function RfqComparisonPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const rfqId = params.id;

  const { role, currentUser, factory } = useAuth();
  const { toast } = useToast();

  const canView = can.viewRFQ(role);
  const canGenerate = can.generatePO(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [data, setData] = React.useState<Awaited<ReturnType<typeof prService.getComparisonData>> | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>("");

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const d = await prService.getComparisonData(rfqId);
      setData(d);
      setSelectedSupplierId((prev) => prev || d.bestOverallSupplierId || d.suppliers[0]?.id || "");
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load comparison",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [rfqId, toast]);

  React.useEffect(() => {
    if (!canView) return;
    void refresh();
  }, [canView, refresh]);

  async function doGenerate() {
    if (!data) return;
    setIsMutating(true);
    try {
      const po = await prService.generatePO({ rfqId: data.rfq.id, supplierId: selectedSupplierId }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "PO generated" });
      router.push(`/purchase/po/${po.id}`);
    } catch (err) {
      toast({
        variant: "error",
        title: "Generate PO failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
      setConfirmOpen(false);
    }
  }

  if (!canView) {
    return (
      <AccessDenied
        title="Cost Comparison"
        message="Purchase has full RFQ/PO access. Planning can view only. Admin can approve and view."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading comparison…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Comparison not available.
      </div>
    );
  }

  if (factory && data.rfq.factory && data.rfq.factory !== factory) {
    return <AccessDenied title="Factory scoped" message="This RFQ belongs to a different factory." />;
  }

  const supplierLabel = (id: string) =>
    data.suppliers.find((s) => s.id === id)?.supplierName ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Cost Comparison — ${data.rfq.rfqNumber}`}
        description="Matrix view of item-wise supplier quotes (landed cost)."
        actions={
          <div className="flex gap-2">
            <Link href="/purchase/rfq">
              <Button variant="secondary">Back</Button>
            </Link>
            <Link href={`/purchase/rfq/${data.rfq.id}/quotes`}>
              <Button variant="secondary">Quotes</Button>
            </Link>
            {canGenerate ? (
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={isMutating || data.rfq.status === "CLOSED" || !selectedSupplierId}
              >
                {role === "admin" ? "Approve & Generate PO" : "Generate PO"}
              </Button>
            ) : (
              <div className="text-sm text-stone-500 self-center">View only</div>
            )}
          </div>
        }
      />

      <div className="ds-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
          <StatusBadge value={data.rfq.status} />
          <div className="text-stone-400">•</div>
          <div>
            Suppliers: <span className="font-medium text-stone-900">{data.suppliers.length}</span>
          </div>
          <div className="text-stone-400">•</div>
          <div>
            Items: <span className="font-medium text-stone-900">{data.lines.length}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-sm font-medium text-stone-700">Supplier for PO</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="ds-select"
            >
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplierCode} — {s.supplierName}
                </option>
              ))}
            </select>
            {data.bestOverallSupplierId ? (
              <div className="text-xs text-stone-500">
                Best overall (by total):{" "}
                <span className="text-stone-700">{supplierLabel(data.bestOverallSupplierId)}</span>
              </div>
            ) : null}
          </div>
          <div className="flex items-end justify-between sm:justify-end">
            <div className="text-sm text-stone-600">
              Selected:{" "}
              <span className="font-medium text-stone-900">
                {supplierLabel(selectedSupplierId)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="ds-table-wrap">
        <div className="ds-table-scroll">
          <table className="ds-table">
            <thead className="ds-thead">
              <tr>
                <th className="ds-th">Item</th>
                <th className="ds-th text-right">Qty</th>
                {data.suppliers.map((s) => (
                  <th key={s.id} className="ds-th">
                    {s.supplierCode}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {data.lines.map((l) => (
                <tr key={l.prItemId} className="ds-tr">
                  <td className="ds-td">
                    <div className="font-medium text-stone-900">{l.itemCode} — {l.itemName}</div>
                    <div className="text-xs text-stone-500">UOM: {l.uom}</div>
                  </td>
                  <td className="ds-td text-right">{l.quantity}</td>
                  {data.suppliers.map((s) => {
                    const cell = l.perSupplier.find((p) => p.supplierId === s.id);
                    const isBest = l.lowestSupplierId === s.id && cell?.landedUnit != null;
                    return (
                      <td
                        key={s.id}
                        className={[
                          "ds-td align-top",
                          isBest ? "bg-emerald-50" : "",
                        ].join(" ")}
                      >
                        {cell?.landedUnit == null ? (
                          <div className="text-sm text-stone-500">—</div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="text-sm text-stone-900">
                              <span className="font-medium">
                                {cell.landedUnit.toFixed(2)}
                              </span>{" "}
                              <span className="text-stone-500">landed</span>
                            </div>
                            <div className="text-xs text-stone-600">
                              Unit: {cell.unitPrice?.toFixed(2)} • Tax: {cell.taxPercent?.toFixed(1)}%
                            </div>
                            <div className="text-xs text-stone-600">
                              Total: {cell.lineTotal?.toFixed(2)} • Delivery: {cell.deliveryDays}d
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="ds-thead">
              <tr>
                <td className="ds-td text-sm font-semibold text-stone-900">Total</td>
                <td className="ds-td" />
                {data.suppliers.map((s) => {
                  const total = data.totalsBySupplier.find((t) => t.supplierId === s.id)?.total ?? 0;
                  const best = data.bestOverallSupplierId === s.id;
                  return (
                    <td
                      key={s.id}
                      className={[
                        "ds-td text-sm font-semibold",
                        best ? "text-emerald-700" : "text-stone-900",
                      ].join(" ")}
                    >
                      {total.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Generate Purchase Order?"
        description={`Generate PO for ${supplierLabel(selectedSupplierId)} and close this RFQ?`}
        confirmLabel="Generate PO"
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
        }}
        onConfirm={() => void doGenerate()}
      />
    </div>
  );
}

