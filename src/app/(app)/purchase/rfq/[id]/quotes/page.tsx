"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Item, RFQ, Supplier, SupplierQuote, SupplierItemPrice } from "@/lib/types";
import { itemService, prService, supplierService, supplierItemPriceService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

type QuoteRow = {
  itemId: string;
  unitPrice: string;
  taxPercent: string;
  deliveryDays: string;
};

type SupplierDraft = {
  supplierId: string;
  rows: QuoteRow[];
  dirty: boolean;
  saving: boolean;
  editing: boolean;
  error: string | null;
};

export default function RfqQuotesPage() {
  const params = useParams<{ id: string }>();
  const rfqId = params.id;

  const { role, currentUser, factory } = useAuth();
  const { toast } = useToast();
  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  const canView = can.viewRFQ(role);
  const canEdit = can.addQuote(role);

  const [isLoading, setIsLoading] = React.useState(true);

  const [rfq, setRfq] = React.useState<RFQ | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [quotes, setQuotes] = React.useState<SupplierQuote[]>([]);
  const [prItemIds, setPrItemIds] = React.useState<string[]>([]);

  const [drafts, setDrafts] = React.useState<SupplierDraft[]>([]);
  const [, setRateMasterPrices] = React.useState<SupplierItemPrice[]>([]);
  const [autoFilled, setAutoFilled] = React.useState(false);

  const itemById = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const rfqData = await prService.getRFQById(rfqId);
      if (!rfqData) {
        setRfq(null);
        return;
      }
      const [itemList, supplierList, prItems, quoteList] = await Promise.all([
        itemService.getItems(),
        supplierService.getSuppliers(),
        prService.getPRItems(rfqData.linkedPrId),
        prService.getSupplierQuotes(rfqData.id),
      ]);
      setRfq(rfqData);
      setItems(itemList);
      const rfqSuppliers = supplierList.filter((s) => rfqData.selectedSuppliers.includes(s.id));
      setSuppliers(rfqSuppliers);
      const itemIds = prItems.map((p) => p.itemId);
      setPrItemIds(itemIds);
      setQuotes(quoteList);

      let rateCards: SupplierItemPrice[] = [];
      try {
        rateCards = await supplierItemPriceService.getForRfqAutoFill(
          itemIds,
          rfqData.selectedSuppliers,
        );
      } catch { /* rate master may not exist yet */ }
      setRateMasterPrices(rateCards);

      const rateMap = new Map<string, SupplierItemPrice>();
      for (const rc of rateCards) {
        rateMap.set(`${rc.supplierId}_${rc.itemId}`, rc);
      }

      let didAutoFill = false;
      setDrafts(rfqSuppliers.map((s) => {
        const existing = quoteList.find((q) => q.supplierId === s.id);
        const rows = itemIds.map((itemId) => {
          const prev = existing?.itemQuotes.find((x) => x.itemId === itemId);
          if (prev) {
            return {
              itemId,
              unitPrice: String(prev.unitPrice),
              taxPercent: String(prev.taxPercent),
              deliveryDays: String(prev.deliveryDays),
            };
          }
          const rate = rateMap.get(`${s.id}_${itemId}`);
          if (rate) {
            didAutoFill = true;
            return {
              itemId,
              unitPrice: String(rate.unitPrice),
              taxPercent: String(rate.taxPercent),
              deliveryDays: String(rate.leadTimeDays),
            };
          }
          return {
            itemId,
            unitPrice: "",
            taxPercent: "18",
            deliveryDays: "7",
          };
        });
        const hasAutoFilled = !existing && rows.some((r) => r.unitPrice !== "");
        return {
          supplierId: s.id,
          rows,
          dirty: hasAutoFilled,
          saving: false,
          editing: !existing || hasAutoFilled,
          error: null,
        };
      }));
      setAutoFilled(didAutoFill);
    } catch (err) {
      toastRef.current({
        variant: "error",
        title: "Failed to load RFQ",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [rfqId]);

  React.useEffect(() => {
    if (!canView) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, rfqId]);

  function updateRow(supplierId: string, itemId: string, patch: Partial<QuoteRow>) {
    setDrafts((prev) =>
      prev.map((d) =>
        d.supplierId === supplierId
          ? { ...d, dirty: true, rows: d.rows.map((r) => (r.itemId === itemId ? { ...r, ...patch } : r)) }
          : d,
      ),
    );
  }

  function setDraftError(supplierId: string, error: string | null) {
    setDrafts((prev) => prev.map((d) => (d.supplierId === supplierId ? { ...d, error } : d)));
  }

  function setDraftSaving(supplierId: string, saving: boolean) {
    setDrafts((prev) => prev.map((d) => (d.supplierId === supplierId ? { ...d, saving } : d)));
  }

  function validateDraft(draft: SupplierDraft) {
    for (const r of draft.rows) {
      const price = parseFloat(r.unitPrice);
      const tax = parseFloat(r.taxPercent);
      const days = parseFloat(r.deliveryDays);
      if (!Number.isFinite(price) || price <= 0) return "Unit price must be > 0 for all items.";
      if (!Number.isFinite(tax) || tax < 0 || tax > 100) return "Tax % must be 0–100.";
      if (!Number.isFinite(days) || days < 0) return "Delivery days must be >= 0.";
    }
    return null;
  }

  async function onSaveSupplier(supplierId: string) {
    const draft = drafts.find((d) => d.supplierId === supplierId);
    if (!draft || !rfq) return;
    setDraftError(supplierId, null);
    const msg = validateDraft(draft);
    if (msg) {
      setDraftError(supplierId, msg);
      return;
    }
    setDraftSaving(supplierId, true);
    try {
      await prService.addSupplierQuote(
        {
          rfqId: rfq.id,
          supplierId,
          itemQuotes: draft.rows.map((r) => ({
            itemId: r.itemId,
            unitPrice: parseFloat(r.unitPrice) || 0,
            taxPercent: parseFloat(r.taxPercent) || 0,
            deliveryDays: parseInt(r.deliveryDays, 10) || 0,
          })),
        },
        { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined },
      );
      setDrafts((prev) => prev.map((d) => (d.supplierId === supplierId ? { ...d, dirty: false, saving: false, editing: false } : d)));
      toast({ variant: "success", title: "Quote saved" });
    } catch (err) {
      setDraftError(supplierId, err instanceof Error ? err.message : "Save failed");
      setDraftSaving(supplierId, false);
    }
  }

  if (!canView) {
    return (
      <AccessDenied
        title="RFQ Quotes"
        message="Purchase has full RFQ/PO access. Planning can view only. Admin can approve and view."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading quotation entry…
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        RFQ not found.
      </div>
    );
  }

  if (factory && rfq.factory && rfq.factory !== factory) {
    return <AccessDenied title="Factory scoped" message="This RFQ belongs to a different factory." />;
  }

  const savedCount = drafts.filter((d) => !d.dirty && quotes.some((q) => q.supplierId === d.supplierId)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Quotation Entry — ${rfq.rfqNumber}`}
        description="Enter and save quotes for each supplier individually."
        actions={
          <div className="flex gap-2">
            <Link href="/purchase/rfq">
              <Button variant="secondary">Back</Button>
            </Link>
            <Link href={`/purchase/rfq/${rfq.id}/comparison`}>
              <Button variant="secondary">Compare quotes</Button>
            </Link>
          </div>
        }
      />

      <div className="ds-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
          <StatusBadge value={rfq.status} />
          <div className="text-stone-400">•</div>
          <div>
            Suppliers: <span className="font-medium text-stone-900">{suppliers.length}</span>
          </div>
          <div className="text-stone-400">•</div>
          <div>
            Items per supplier: <span className="font-medium text-stone-900">{prItemIds.length}</span>
          </div>
          <div className="text-stone-400">•</div>
          <div>
            Saved: <span className="font-medium text-stone-900">{savedCount}/{suppliers.length}</span>
          </div>
        </div>
      </div>

      {autoFilled && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-emerald-800">
            <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>
              <strong>Auto-filled from Rate Master.</strong> Rates were pre-populated from your supplier price list. Review and save each supplier&apos;s quote.
            </span>
          </div>
        </div>
      )}

      {drafts.map((draft, draftIdx) => {
        const supplier = suppliers.find((s) => s.id === draft.supplierId);
        if (!supplier) return null;
        const existingQuote = quotes.find((q) => q.supplierId === draft.supplierId);
        const isSaved = !!existingQuote && !draft.dirty;
        return (
          <div
            key={draft.supplierId}
            className={[
              "rounded-lg bg-white border shadow-sm overflow-hidden",
              isSaved ? "border-emerald-200" : draft.dirty ? "border-amber-200" : "border-stone-200",
            ].join(" ")}
          >
            <div className={[
              "flex items-center justify-between gap-3 px-5 py-3",
              isSaved ? "bg-emerald-50" : draft.dirty ? "bg-amber-50" : "bg-stone-50",
            ].join(" ")}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-stone-900 text-[11px] font-bold text-white">
                    {draftIdx + 1}
                  </span>
                  <span className="text-sm font-semibold text-stone-900 truncate">
                    {supplier.supplierCode} — {supplier.supplierName}
                  </span>
                  {isSaved && (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      Saved
                    </span>
                  )}
                  {draft.dirty && (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Unsaved
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-stone-500">
                  {supplier.gstNumber ? `GST: ${supplier.gstNumber}` : "GST: —"} •{" "}
                  {supplier.paymentTerms ? `Terms: ${supplier.paymentTerms}` : "Terms: —"}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  {isSaved && !draft.editing && (
                    <Button
                      variant="secondary"
                      onClick={() => setDrafts((prev) => prev.map((d) => (d.supplierId === draft.supplierId ? { ...d, editing: true } : d)))}
                    >
                      Edit
                    </Button>
                  )}
                  {draft.editing && (
                    <Button
                      onClick={() => void onSaveSupplier(draft.supplierId)}
                      disabled={draft.saving || !draft.dirty}
                      variant={draft.dirty ? "primary" : "secondary"}
                    >
                      {draft.saving
                        ? "Saving…"
                        : existingQuote && draft.dirty
                          ? "Update quote"
                          : draft.dirty
                            ? "Save quote"
                            : "No changes"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="ds-table-wrap ring-0 border-t border-stone-100">
              <div className="ds-table-scroll">
                <table className="ds-table">
                  <thead className="ds-thead">
                    <tr>
                      <th className="ds-th">Item</th>
                      <th className="ds-th text-right">Unit price (₹)</th>
                      <th className="ds-th text-right">Tax %</th>
                      <th className="ds-th text-right">Delivery (days)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {draft.rows.map((r) => {
                      const it = itemById.get(r.itemId);
                      return (
                        <tr key={r.itemId} className="ds-tr">
                          <td className="ds-td">
                            {it ? (
                              <div>
                                <div className="text-sm font-medium text-stone-900">{it.itemCode} — {it.itemName}</div>
                                <div className="text-xs text-stone-500">UOM: {it.uom}</div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="ds-td text-right">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="0.00"
                              value={r.unitPrice}
                              onChange={(e) => updateRow(draft.supplierId, r.itemId, { unitPrice: e.target.value })}
                              disabled={!draft.editing}
                              className="ds-input w-28 text-right"
                            />
                          </td>
                          <td className="ds-td text-right">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.1"
                              placeholder="18"
                              value={r.taxPercent}
                              onChange={(e) => updateRow(draft.supplierId, r.itemId, { taxPercent: e.target.value })}
                              disabled={!draft.editing}
                              className="ds-input w-24 text-right"
                            />
                          </td>
                          <td className="ds-td text-right">
                            <input
                              type="number"
                              min={0}
                              step="1"
                              placeholder="7"
                              value={r.deliveryDays}
                              onChange={(e) => updateRow(draft.supplierId, r.itemId, { deliveryDays: e.target.value })}
                              disabled={!draft.editing}
                              className="ds-input w-24 text-right"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {draft.error && (
              <div className="border-t border-stone-100 px-5 py-2">
                <div className="ds-alert-error text-sm">{draft.error}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

