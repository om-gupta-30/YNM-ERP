"use client";

import * as React from "react";
import type { BOM, BOMItem, Item } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";

type LineDraft = {
  id: string;
  rawMaterialItemId: string;
  quantityPerUnit: number;
  scrapPercentage: number;
};

function genRowId() {
  return `row_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeBomCode(code: string) {
  return code.trim().toUpperCase();
}

function formatItemLabel(i: Item) {
  return `${i.itemCode} — ${i.itemName}`;
}

export function BOMBuilder(props: {
  mode: "create" | "edit" | "view";
  roleMode: "full" | "view";
  bom?: BOM | null;
  bomItems?: BOMItem[];
  finishedGoods: Item[];
  materialItems: Item[];
  isSaving?: boolean;
  onCancel: () => void;
  onSave: (payload: {
    finishedGoodItemId: string;
    bomCode: string;
    lines: Array<{
      rawMaterialItemId: string;
      quantityPerUnit: number;
      scrapPercentage: number;
    }>;
  }) => Promise<void> | void;
}) {
  const isReadOnly = props.mode === "view" || props.roleMode === "view";

  const initialFgId = props.bom?.finishedGoodItemId ?? "";
  const initialBomCode = props.bom?.bomCode ?? "";

  const [finishedGoodItemId, setFinishedGoodItemId] = React.useState(initialFgId);
  const [bomCode, setBomCode] = React.useState(initialBomCode);
  const [lines, setLines] = React.useState<LineDraft[]>(() => {
    if (props.bomItems && props.bomItems.length) {
      return props.bomItems.map((l) => ({
        id: l.id,
        rawMaterialItemId: l.rawMaterialItemId,
        quantityPerUnit: l.quantityPerUnit,
        scrapPercentage: l.scrapPercentage,
      }));
    }
    return [{ id: genRowId(), rawMaterialItemId: "", quantityPerUnit: 1, scrapPercentage: 0 }];
  });

  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setFinishedGoodItemId(initialFgId);
    setBomCode(initialBomCode);
    setLines(() => {
      if (props.bomItems && props.bomItems.length) {
        return props.bomItems.map((l) => ({
          id: l.id,
          rawMaterialItemId: l.rawMaterialItemId,
          quantityPerUnit: l.quantityPerUnit,
          scrapPercentage: l.scrapPercentage,
        }));
      }
      return [{ id: genRowId(), rawMaterialItemId: "", quantityPerUnit: 1, scrapPercentage: 0 }];
    });
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.bom?.id]);

  const fgById = React.useMemo(
    () => new Map(props.finishedGoods.map((i) => [i.id, i])),
    [props.finishedGoods],
  );
  const matById = React.useMemo(
    () => new Map(props.materialItems.map((i) => [i.id, i])),
    [props.materialItems],
  );

  React.useEffect(() => {
    if (props.mode !== "create") return;
    const fg = fgById.get(finishedGoodItemId);
    if (!fg) return;
    setBomCode(normalizeBomCode(`BOM-${fg.itemCode}`));
  }, [fgById, finishedGoodItemId, props.mode]);

  const selectedMaterialIds = React.useMemo(
    () => new Set(lines.map((l) => l.rawMaterialItemId).filter(Boolean)),
    [lines],
  );

  const materialCount = selectedMaterialIds.size;
  const totalQty = React.useMemo(
    () => lines.reduce((sum, l) => sum + (Number.isFinite(l.quantityPerUnit) ? l.quantityPerUnit : 0), 0),
    [lines],
  );

  function addRow() {
    setLines((prev) => [...prev, { id: genRowId(), rawMaterialItemId: "", quantityPerUnit: 1, scrapPercentage: 0 }]);
  }

  function removeRow(rowId: string) {
    setLines((prev) => {
      const next = prev.filter((r) => r.id !== rowId);
      return next.length ? next : [{ id: genRowId(), rawMaterialItemId: "", quantityPerUnit: 1, scrapPercentage: 0 }];
    });
  }

  function updateRow(rowId: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function validate() {
    if (!finishedGoodItemId) return "Finished good is required.";
    if (!bomCode.trim()) return "BOM code is required.";

    const ids = lines.map((l) => l.rawMaterialItemId).filter(Boolean);
    if (ids.length === 0) return "Add at least one raw material/semi-finished line.";
    if (new Set(ids).size !== ids.length) return "Duplicate raw materials are not allowed.";

    for (const l of lines) {
      if (!l.rawMaterialItemId) return "Each row must have a raw material selected.";
      if (!Number.isFinite(l.quantityPerUnit) || l.quantityPerUnit <= 0) return "Quantity per unit must be > 0.";
      if (!Number.isFinite(l.scrapPercentage) || l.scrapPercentage < 0 || l.scrapPercentage > 100) {
        return "Scrap % must be between 0 and 100.";
      }
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
      finishedGoodItemId,
      bomCode: normalizeBomCode(bomCode),
      lines: lines.map((l) => ({
        rawMaterialItemId: l.rawMaterialItemId,
        quantityPerUnit: Number(l.quantityPerUnit),
        scrapPercentage: Number(l.scrapPercentage),
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
              <div className="text-sm font-semibold text-stone-950">BOM header</div>
              <div className="text-sm text-stone-600">
                Select finished good and review BOM code/version.
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-sm font-medium text-stone-700">
                  Finished Good (required)
                </label>
                <select
                  value={finishedGoodItemId}
                  onChange={(e) => setFinishedGoodItemId(e.target.value)}
                  disabled={isReadOnly || props.mode === "edit"}
                  className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 ring-1 ring-inset ring-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
                >
                  <option value="">Select finished good…</option>
                  {props.finishedGoods.map((i) => (
                    <option key={i.id} value={i.id}>
                      {formatItemLabel(i)}
                    </option>
                  ))}
                </select>
                {props.mode === "edit" ? (
                  <div className="text-xs text-stone-500">
                    Finished good is locked when creating a new version.
                  </div>
                ) : null}
              </div>

              <div>
                <Input
                  label="BOM Code"
                  value={bomCode}
                  onChange={(e) => setBomCode(e.target.value)}
                  disabled={isReadOnly || props.mode === "create"}
                  error={!bomCode.trim() && error ? "Required" : undefined}
                  placeholder="Auto-generated"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              {props.bom ? (
                <>
                  <StatusBadge value={props.bom.isActive ? "Active" : "Inactive"} />
                  <span className="text-stone-500">Version</span>
                  <span className="font-medium text-stone-900">{props.bom.version}</span>
                </>
              ) : (
                <span className="text-stone-500">New BOM (version will be assigned on save)</span>
              )}
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
                <div className="text-sm font-semibold text-stone-950">BOM lines</div>
                <div className="text-sm text-stone-600">
                  Add raw material and semi-finished components per unit output.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700 ring-1 ring-inset ring-stone-200">
                  <span className="font-medium text-stone-900">{materialCount}</span>{" "}
                  materials •{" "}
                  <span className="font-medium text-stone-900">
                    {totalQty.toFixed(3).replace(/\.?0+$/, "")}
                  </span>{" "}
                  total qty
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
                      Raw material / SFG
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-600">
                      Qty / unit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-600">
                      Scrap %
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {lines.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50/60">
                      <td className="px-4 py-3">
                        <select
                          value={row.rawMaterialItemId}
                          onChange={(e) =>
                            updateRow(row.id, { rawMaterialItemId: e.target.value })
                          }
                          disabled={isReadOnly}
                          className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 ring-1 ring-inset ring-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
                        >
                          <option value="">Select material…</option>
                          {props.materialItems.map((i) => {
                            const alreadySelected =
                              selectedMaterialIds.has(i.id) && i.id !== row.rawMaterialItemId;
                            return (
                              <option key={i.id} value={i.id} disabled={alreadySelected}>
                                {formatItemLabel(i)}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.001"
                          min={0}
                          value={String(row.quantityPerUnit)}
                          onChange={(e) =>
                            updateRow(row.id, { quantityPerUnit: Number(e.target.value) })
                          }
                          disabled={isReadOnly}
                          className="h-9 w-28 rounded-md bg-white px-3 text-right text-sm text-stone-900 ring-1 ring-inset ring-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          max={100}
                          value={String(row.scrapPercentage)}
                          onChange={(e) =>
                            updateRow(row.id, { scrapPercentage: Number(e.target.value) })
                          }
                          disabled={isReadOnly}
                          className="h-9 w-24 rounded-md bg-white px-3 text-right text-sm text-stone-900 ring-1 ring-inset ring-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isReadOnly ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeRow(row.id)}
                          >
                            Remove
                          </Button>
                        ) : (
                          <span className="text-sm text-stone-500">
                            {matById.get(row.rawMaterialItemId)
                              ? matById.get(row.rawMaterialItemId)?.uom
                              : "—"}
                          </span>
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
          Back
        </Button>
        {!isReadOnly ? (
          <Button type="submit" disabled={props.isSaving}>
            {props.isSaving ? "Saving…" : props.mode === "edit" ? "Create new version" : "Create BOM"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

