"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { GateEntry, GRN, GRNItem, Item, PurchaseOrder, Supplier } from "@/lib/types";
import { inventoryService, itemService, prService, supplierService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { KpiCard } from "@/components/ui/KpiCard";
import { generateGrnPdf, type GrnPdfData } from "@/lib/generateGrnPdf";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function GrnDetailPage() {
  const params = useParams<{ id: string }>();
  const grnId = params.id;

  const { role, factory, currentUser } = useAuth();
  const { toast } = useToast();

  const viewOk = can.viewGRN(role);
  const canApprove = can.approveGRN(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);

  const [grn, setGrn] = React.useState<GRN | null>(null);
  const [gateEntry, setGateEntry] = React.useState<GateEntry | null>(null);
  const [po, setPo] = React.useState<PurchaseOrder | null>(null);
  const [supplier, setSupplier] = React.useState<Supplier | null>(null);
  const [itemsById, setItemsById] = React.useState<Map<string, Item>>(new Map());
  const [lines, setLines] = React.useState<GRNItem[]>([]);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [grn, grnItems, gates, suppliers, items] = await Promise.all([
        inventoryService.getGRNById(grnId),
        inventoryService.getGRNItems(grnId),
        inventoryService.getGateEntries({ factory: factory ?? "YNM-HYD" }),
        supplierService.getSuppliers(),
        itemService.getItems(),
      ]);
      setGrn(grn);
      setLines(grnItems);
      setItemsById(new Map(items.map((i) => [i.id, i])));

      if (grn) {
        const gate = gates.find((g) => g.id === grn.gateEntryId) ?? null;
        setGateEntry(gate);
        const po = await prService.getPOById(grn.poId);
        setPo(po);
        setSupplier(suppliers.find((s) => s.id === (gate?.supplierId ?? "")) ?? null);
      } else {
        setGateEntry(null);
        setPo(null);
        setSupplier(null);
      }
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load GRN",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [factory, grnId, toast]);

  React.useEffect(() => {
    if (!viewOk) return;
    void refresh();
  }, [refresh, viewOk]);

  const totals = React.useMemo(() => {
    const ordered = lines.reduce((s, l) => s + l.orderedQty, 0);
    const received = lines.reduce((s, l) => s + l.receivedQty, 0);
    const accepted = lines.reduce((s, l) => s + l.acceptedQty, 0);
    const rejected = lines.reduce((s, l) => s + l.rejectedQty, 0);
    return { ordered, received, accepted, rejected };
  }, [lines]);

  function updateLine(itemId: string, patch: Partial<Pick<GRNItem, "receivedQty" | "acceptedQty" | "rejectedQty">>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.itemId !== itemId) return l;
        const receivedQty = patch.receivedQty ?? l.receivedQty;
        const acceptedQty = patch.acceptedQty ?? l.acceptedQty;
        const safeReceived = Math.max(0, Number(receivedQty) || 0);
        const safeAccepted = Math.max(0, Math.min(Number(acceptedQty) || 0, safeReceived));
        const safeRejected = Math.max(0, safeReceived - safeAccepted);
        return { ...l, receivedQty: safeReceived, acceptedQty: safeAccepted, rejectedQty: safeRejected };
      }),
    );
  }

  async function onApprove() {
    if (!grn) return;
    setIsMutating(true);
    try {
      await inventoryService.approveGRN({
        grnId: grn.id,
        items: lines.map((l) => ({
          itemId: l.itemId,
          receivedQty: l.receivedQty,
          acceptedQty: l.acceptedQty,
        })),
      }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "GRN approved and stock updated" });
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Approve failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
      setConfirmOpen(false);
    }
  }

  async function onDownloadPdf() {
    if (!grn) return;
    setIsGeneratingPdf(true);
    try {
      let poItemRows: GrnPdfData["poItems"] = [];
      if (grn.poId) {
        const { data } = await getSupabaseBrowserClient()
          .from("po_items")
          .select("item_id, unit_price, tax_percent, total_amount")
          .eq("po_id", grn.poId);
        poItemRows = (data ?? []).map((r) => ({
          itemId: r.item_id as string,
          unitPrice: Number(r.unit_price ?? 0),
          taxPercent: Number(r.tax_percent ?? 0),
          totalAmount: Number(r.total_amount ?? 0),
        }));
      }

      const pdfData: GrnPdfData = {
        grn,
        grnItems: lines,
        gateEntry,
        po,
        supplier,
        items: itemsById,
        poItems: poItemRows,
      };
      const doc = generateGrnPdf(pdfData);
      doc.save(`${grn.grnNumber}.pdf`);
      toast({ variant: "success", title: "PDF downloaded" });
    } catch (err) {
      toast({
        variant: "error",
        title: "PDF generation failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  if (!viewOk) {
    return (
      <AccessDenied
        title="GRN Details"
        message="Stores has full access. Purchase has view-only access. Other roles have no access."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading GRN…
      </div>
    );
  }

  if (!grn) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        GRN not found.
      </div>
    );
  }

  if (factory && grn.factory && grn.factory !== factory) {
    return <AccessDenied title="Factory scoped" message="This GRN belongs to a different factory." />;
  }

  const readOnly = grn.status !== "DRAFT" || !canApprove;

  return (
    <div className="space-y-6">
      <PageHeader
        title={grn.grnNumber}
        description={[
          gateEntry ? `Gate: ${gateEntry.gateEntryNumber}` : "Gate: —",
          po ? `PO: ${po.poNumber}` : "PO: —",
          supplier ? `Supplier: ${supplier.supplierCode} — ${supplier.supplierName}` : "Supplier: —",
        ].join(" • ")}
        actions={
          <div className="flex gap-2">
            <Link href="/inventory/grn">
              <Button variant="secondary">Back</Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => void onDownloadPdf()}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? "Generating…" : "Download PDF"}
            </Button>
            {canApprove && grn.status === "DRAFT" ? (
              <Button onClick={() => setConfirmOpen(true)} disabled={isMutating}>
                Approve GRN
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="ds-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
          <StatusBadge value={grn.status} />
          <div className="text-stone-400">•</div>
          <div className="text-stone-500">
            Created: <span className="text-stone-700">{new Date(grn.createdAt).toLocaleString()}</span>
          </div>
          {readOnly ? <div className="text-stone-400">•</div> : null}
          {readOnly ? <div className="text-sm text-stone-500">Read-only</div> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Ordered qty" value={totals.ordered} />
        <KpiCard label="Received qty" value={totals.received} />
        <KpiCard label="Accepted qty" value={totals.accepted} />
        <KpiCard label="Rejected qty" value={totals.rejected} />
      </div>

      <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-900 text-sm font-semibold text-white">
            1
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-stone-950">Receiving quantities</div>
            <div className="text-sm text-stone-600">
              Enter received quantity. Accepted defaults to received; adjust accepted to record rejection.
            </div>
          </div>
        </div>

        <div className="mt-4">
          <DataTable
            rows={lines}
            columns={[
              {
                header: "Item",
                cell: (r) => {
                  const it = itemsById.get(r.itemId);
                  return it ? `${it.itemCode} — ${it.itemName}` : "—";
                },
              },
              {
                header: "UOM",
                cell: (r) => itemsById.get(r.itemId)?.uom ?? "—",
                className: "w-20",
              },
              {
                header: "Ordered",
                cell: (r) => String(r.orderedQty),
                className: "text-right w-24",
              },
              {
                header: "Received",
                cell: (r) => (
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={String(r.receivedQty)}
                    disabled={readOnly}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      updateLine(r.itemId, { receivedQty: v, acceptedQty: v });
                    }}
                    className="h-9 w-24 rounded-md bg-white px-3 text-right text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
                  />
                ),
                className: "text-right w-28",
              },
              {
                header: "Accepted",
                cell: (r) => (
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={String(r.acceptedQty)}
                    disabled={readOnly}
                    onChange={(e) => updateLine(r.itemId, { acceptedQty: Number(e.target.value) })}
                    className="h-9 w-24 rounded-md bg-white px-3 text-right text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
                  />
                ),
                className: "text-right w-28",
              },
              {
                header: "Rejected",
                cell: (r) => String(r.rejectedQty),
                className: "text-right w-24",
              },
            ]}
            emptyState="No items found."
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Approve GRN?"
        description="Approving will post INWARD stock ledger entries for accepted quantities and close the gate entry."
        confirmLabel="Approve"
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
        }}
        onConfirm={() => void onApprove()}
      />
    </div>
  );
}

