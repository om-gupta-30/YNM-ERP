"use client";

import * as React from "react";
import type { Item, Supplier } from "@/lib/types";
import type { RankedSupplier } from "@/lib/services/supplierItemPriceService";
import { itemService, supplierService, supplierItemPriceService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

const RANK_COLORS: Record<number, { bg: string; border: string; badge: string; text: string }> = {
  1: { bg: "bg-emerald-50", border: "border-emerald-300", badge: "bg-emerald-600 text-white", text: "text-emerald-800" },
  2: { bg: "bg-blue-50", border: "border-blue-300", badge: "bg-blue-600 text-white", text: "text-blue-800" },
  3: { bg: "bg-amber-50", border: "border-amber-300", badge: "bg-amber-600 text-white", text: "text-amber-800" },
};

function getRankStyle(rank: number) {
  return RANK_COLORS[rank] ?? { bg: "bg-stone-50", border: "border-stone-200", badge: "bg-stone-500 text-white", text: "text-stone-700" };
}

export default function PriceFinderPage() {
  const { role } = useAuth();
  const { toast } = useToast();

  const canView = can.viewRateMaster(role) || can.viewPR(role);

  const [items, setItems] = React.useState<Item[]>([]);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = React.useState(true);

  const [selectedItemId, setSelectedItemId] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [results, setResults] = React.useState<RankedSupplier[] | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);

  const supplierById = React.useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  React.useEffect(() => {
    if (!canView) return;
    (async () => {
      setIsLoadingMaster(true);
      try {
        const [i, s] = await Promise.all([itemService.getItems(), supplierService.getSuppliers()]);
        setItems(i);
        setSuppliers(s);
      } catch (err) {
        toast({ variant: "error", title: "Load failed", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        setIsLoadingMaster(false);
      }
    })();
  }, [canView, toast]);

  async function doSearch() {
    if (!selectedItemId) return;
    setIsSearching(true);
    setResults(null);
    try {
      const qty = parseFloat(quantity) || undefined;
      const ranked = await supplierItemPriceService.getRankedSuppliers(selectedItemId, qty);
      setResults(ranked);
    } catch (err) {
      toast({ variant: "error", title: "Search failed", message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsSearching(false);
    }
  }

  React.useEffect(() => {
    if (selectedItemId) void doSearch();
    else setResults(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId, quantity]);

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const qty = parseFloat(quantity) || 0;

  if (!canView) {
    return <AccessDenied title="Price Finder" message="Only admin, purchase, or planning roles can access the price finder." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Price Finder"
        description="Instantly find the best-priced supplier for any item. L1 = lowest cost, L2 = second lowest, and so on."
        hint="Select an item and quantity to see all suppliers ranked by landed cost (unit price + tax). The system pulls rates from the Rate Master."
      />

      <div className="ds-surface p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-sm font-medium text-stone-700">Item *</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              disabled={isLoadingMaster}
              className="ds-select"
            >
              <option value="">Select an item…</option>
              {items.filter((i) => i.isActive).map((i) => (
                <option key={i.id} value={i.id}>{i.itemCode} — {i.itemName} ({i.uom})</option>
              ))}
            </select>
          </div>
          <Input
            label="Quantity"
            type="number"
            min={1}
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1"
          />
        </div>
      </div>

      {isSearching && (
        <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
          Searching for the best suppliers…
        </div>
      )}

      {results !== null && !isSearching && results.length === 0 && (
        <div className="rounded-lg bg-white p-6 border border-stone-200 shadow-sm">
          <div className="text-center space-y-2 py-4">
            <div className="text-lg font-medium text-stone-700">No rates found</div>
            <div className="text-sm text-stone-500">
              No supplier has a rate for{" "}
              <span className="font-medium">{selectedItem?.itemCode ?? "this item"}</span> in the Rate Master.
            </div>
            <div className="text-sm text-stone-500">
              Go to <span className="font-medium">Setup → Rate Master</span> to add supplier rates first.
            </div>
          </div>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="ds-h2">
              {results.length} Supplier{results.length !== 1 ? "s" : ""} for{" "}
              <span className="text-stone-900">{selectedItem?.itemCode}</span>
            </h2>
            {qty > 0 && (
              <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
                Qty: {qty} {selectedItem?.uom}
              </span>
            )}
          </div>

          {/* Best supplier highlight */}
          {results[0] && (() => {
            const best = results[0];
            const sup = supplierById.get(best.supplierId);
            return (
              <div className="rounded-xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50 to-emerald-100/50 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white shadow">
                        L1
                      </span>
                      <div>
                        <div className="text-lg font-semibold text-stone-900">
                          {sup?.supplierCode ?? "—"} — {sup?.supplierName ?? "—"}
                        </div>
                        <div className="text-xs text-stone-500">
                          Best price • {best.leadTimeDays} day{best.leadTimeDays !== 1 ? "s" : ""} delivery
                          {best.remarks ? ` • ${best.remarks}` : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-700">
                      ₹{best.landedPrice.toFixed(2)}
                    </div>
                    <div className="text-xs text-stone-500">
                      landed per {selectedItem?.uom ?? "unit"}
                    </div>
                    {best.totalCost != null && qty > 0 && (
                      <div className="mt-1 text-sm font-medium text-emerald-800">
                        Total: ₹{best.totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-600">
                  <span>Unit: ₹{best.unitPrice.toFixed(2)}</span>
                  <span>Tax: {best.taxPercent}%</span>
                  <span>MOQ: {best.minOrderQty} {selectedItem?.uom ?? ""}</span>
                  {best.effectiveFrom && <span>From: {best.effectiveFrom}</span>}
                  {best.effectiveTo && <span>Until: {best.effectiveTo}</span>}
                </div>
              </div>
            );
          })()}

          {/* Comparison table for all suppliers */}
          <div className="ds-table-wrap">
            <div className="ds-table-scroll">
              <table className="ds-table">
                <thead className="ds-thead">
                  <tr>
                    <th className="ds-th w-16">Rank</th>
                    <th className="ds-th">Supplier</th>
                    <th className="ds-th text-right">Unit Price (₹)</th>
                    <th className="ds-th text-right">Tax %</th>
                    <th className="ds-th text-right">Landed (₹)</th>
                    {qty > 0 && <th className="ds-th text-right">Total Cost (₹)</th>}
                    <th className="ds-th text-right">Lead Time</th>
                    <th className="ds-th text-right">MOQ</th>
                    <th className="ds-th">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {results.map((r) => {
                    const style = getRankStyle(r.rank);
                    const sup = supplierById.get(r.supplierId);
                    const savings = r.rank > 1 && results[0]
                      ? Number(((r.landedPrice - results[0].landedPrice) / results[0].landedPrice * 100).toFixed(1))
                      : null;
                    return (
                      <tr key={r.id} className={`ds-tr ${style.bg}`}>
                        <td className="ds-td">
                          <span className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${style.badge}`}>
                            {r.label}
                          </span>
                        </td>
                        <td className="ds-td">
                          <div className="font-medium text-stone-900">{sup?.supplierCode ?? "—"}</div>
                          <div className="text-xs text-stone-500">{sup?.supplierName ?? "—"}</div>
                        </td>
                        <td className="ds-td text-right font-medium text-stone-900">
                          {r.unitPrice.toFixed(2)}
                        </td>
                        <td className="ds-td text-right text-stone-700">{r.taxPercent}%</td>
                        <td className="ds-td text-right">
                          <span className={`font-semibold ${style.text}`}>{r.landedPrice.toFixed(2)}</span>
                          {savings !== null && savings > 0 && (
                            <div className="text-[10px] text-red-500">+{savings}% vs L1</div>
                          )}
                        </td>
                        {qty > 0 && (
                          <td className="ds-td text-right font-medium text-stone-900">
                            {r.totalCost != null
                              ? `₹${r.totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                              : "—"}
                          </td>
                        )}
                        <td className="ds-td text-right text-stone-700">{r.leadTimeDays}d</td>
                        <td className="ds-td text-right text-stone-700">{r.minOrderQty}</td>
                        <td className="ds-td text-xs text-stone-500">{r.remarks || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick summary cards */}
          {results.length >= 2 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {results.slice(0, 3).map((r) => {
                const style = getRankStyle(r.rank);
                const sup = supplierById.get(r.supplierId);
                return (
                  <div key={r.id} className={`rounded-lg border ${style.border} ${style.bg} p-4`}>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${style.badge}`}>
                        {r.label}
                      </span>
                      <span className="text-sm font-semibold text-stone-900">{sup?.supplierCode ?? "—"}</span>
                    </div>
                    <div className={`mt-2 text-xl font-bold ${style.text}`}>₹{r.landedPrice.toFixed(2)}</div>
                    <div className="text-xs text-stone-500">per {selectedItem?.uom ?? "unit"} landed</div>
                    {qty > 0 && r.totalCost != null && (
                      <div className="mt-1 text-sm font-medium text-stone-700">
                        Total: ₹{r.totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-stone-500">{r.leadTimeDays}d delivery • MOQ {r.minOrderQty}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
