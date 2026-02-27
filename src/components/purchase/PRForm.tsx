"use client";

import * as React from "react";
import type { Item, PurchaseRequisition, PurchaseRequisitionItem } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type RowDraft = {
  id: string;
  itemId: string;
  quantity: number;
  remarks: string;
};

function genRowId() {
  return `row_${Math.random().toString(36).slice(2, 10)}`;
}

function itemLabel(i: Item) {
  return `${i.itemCode} — ${i.itemName}`;
}


export function PRForm(props: {
  mode: "create" | "edit";
  pr?: PurchaseRequisition | null;
  prItems?: PurchaseRequisitionItem[];
  items: Item[];
  isSaving?: boolean;
  onCancel: () => void;
  onSave: (payload: {
    department: string;
    items: Array<{ itemId: string; quantity: number; remarks: string }>;
  }) => Promise<void> | void;
}) {
  const isEdit = props.mode === "edit";
  const isReadOnly = props.pr?.status && props.pr.status !== "DRAFT";

  const department = props.pr?.department ?? "Planning";
  const [rows, setRows] = React.useState<RowDraft[]>(() => {
    if (props.prItems?.length) {
      return props.prItems.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        quantity: i.quantity,
        remarks: i.remarks,
      }));
    }
    return [{ id: genRowId(), itemId: "", quantity: 1, remarks: "" }];
  });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRows(() => {
      if (props.prItems?.length) {
        return props.prItems.map((i) => ({
          id: i.id,
          itemId: i.itemId,
          quantity: i.quantity,
          remarks: i.remarks,
        }));
      }
      return [{ id: genRowId(), itemId: "", quantity: 1, remarks: "" }];
    });
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pr?.id]);

  const itemsById = React.useMemo(() => new Map(props.items.map((i) => [i.id, i])), [props.items]);

  const selectedItemIds = React.useMemo(
    () => new Set(rows.map((r) => r.itemId).filter(Boolean)),
    [rows],
  );

  const totalQty = React.useMemo(
    () => rows.reduce((sum, r) => sum + (Number.isFinite(r.quantity) ? r.quantity : 0), 0),
    [rows],
  );

  function addRow() {
    setRows((prev) => [...prev, { id: genRowId(), itemId: "", quantity: 1, remarks: "" }]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId);
      return next.length ? next : [{ id: genRowId(), itemId: "", quantity: 1, remarks: "" }];
    });
  }

  function updateRow(rowId: string, patch: Partial<RowDraft>) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function validate() {
    const ids = rows.map((r) => r.itemId).filter(Boolean);
    if (ids.length === 0) return "Add at least one item row.";
    if (new Set(ids).size !== ids.length) return "Duplicate items are not allowed.";
    for (const r of rows) {
      if (!r.itemId) return "Each row must have an item selected.";
      if (!Number.isFinite(r.quantity) || r.quantity <= 0) return "Quantity must be > 0.";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    await props.onSave({
      department,
      items: rows.map((r) => ({
        itemId: r.itemId,
        quantity: Number(r.quantity),
        remarks: r.remarks?.trim() ?? "",
      })),
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-inset ring-stone-200">
        <div className="flex items-start gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-900 text-sm font-semibold text-white">
            1
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="text-sm font-semibold text-stone-950">PR details</div>
              <div className="text-sm text-stone-600">
                A unique PR number will be auto-generated when you save.
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="PR Number"
                value={props.pr?.prNumber ?? "Auto-generated on save"}
                disabled
              />
              <Input
                label="Department"
                value={department}
                disabled
              />
              {isEdit && props.pr ? (
                <Input
                  label="Status"
                  value={props.pr.status}
                  disabled
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-inset ring-stone-200">
        <div className="flex items-start gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-900 text-sm font-semibold text-white">
            2
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-stone-950">PR items</div>
                <div className="text-sm text-stone-600">
                  Add items from Item Master with quantity and remarks.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700 ring-1 ring-inset ring-stone-200">
                  <span className="font-medium text-stone-900">{selectedItemIds.size}</span>{" "}
                  items •{" "}
                  <span className="font-medium text-stone-900">{totalQty}</span> total qty
                </div>
                {!isReadOnly ? (
                  <Button type="button" variant="secondary" onClick={addRow}>
                    Add row
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg ring-1 ring-inset ring-stone-200">
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-600 w-20">
                      UOM
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-600">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                      Remarks
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50/60">
                      <td className="px-4 py-3">
                        <select
                          value={row.itemId}
                          onChange={(e) => updateRow(row.id, { itemId: e.target.value })}
                          disabled={Boolean(isReadOnly)}
                          className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 ring-1 ring-inset ring-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
                        >
                          <option value="">Select item…</option>
                          {props.items
                            .filter((i) => i.isActive)
                            .map((i) => {
                              const alreadySelected =
                                selectedItemIds.has(i.id) && i.id !== row.itemId;
                              return (
                                <option key={i.id} value={i.id} disabled={alreadySelected}>
                                  {itemLabel(i)}
                                </option>
                              );
                            })}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {row.itemId ? (itemsById.get(row.itemId)?.uom ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={String(row.quantity)}
                          onChange={(e) =>
                            updateRow(row.id, { quantity: Number(e.target.value) })
                          }
                          disabled={Boolean(isReadOnly)}
                          className="h-9 w-28 rounded-md bg-white px-3 text-right text-sm text-stone-900 ring-1 ring-inset ring-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={row.remarks}
                          onChange={(e) => updateRow(row.id, { remarks: e.target.value })}
                          disabled={Boolean(isReadOnly)}
                          className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 ring-1 ring-inset ring-stone-200 placeholder:text-stone-400 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
                          placeholder="Optional remarks"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isReadOnly ? (
                          <Button type="button" variant="ghost" onClick={() => removeRow(row.id)}>
                            Remove
                          </Button>
                        ) : (
                          <span className="text-sm text-stone-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error ? (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={props.onCancel} disabled={props.isSaving}>
          Cancel
        </Button>
        {!isReadOnly ? (
          <Button type="submit" disabled={props.isSaving}>
            {props.isSaving ? "Saving…" : props.mode === "edit" ? "Save changes" : "Create draft"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

