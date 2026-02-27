"use client";

import * as React from "react";
import type { Item, ItemType } from "@/lib/types";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Mode = "create" | "edit";

export type ItemFormValues = {
  itemCode: string;
  itemName: string;
  itemType: ItemType;
  category: string;
  uom: Item["uom"];
  hsnCode: string;
  reorderLevel: number;
  isBomApplicable: boolean;
};

const itemTypes: Array<{ value: ItemType; label: string }> = [
  { value: "RAW_MATERIAL", label: "Raw Material" },
  { value: "SEMI_FINISHED", label: "Semi Finished" },
  { value: "FINISHED_GOOD", label: "Finished Good" },
  { value: "TRADING", label: "Trading" },
];

const uoms: Item["uom"][] = ["NOS", "KG", "MTR"];

function normalize(code: string) {
  return code.trim().toUpperCase();
}

export function ItemForm(props: {
  open: boolean;
  mode: Mode;
  existingItems: Item[];
  initialItem?: Item | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (values: ItemFormValues) => Promise<void> | void;
}) {
  const initial = props.initialItem;

  const [values, setValues] = React.useState<ItemFormValues>(() => ({
    itemCode: initial?.itemCode ?? "",
    itemName: initial?.itemName ?? "",
    itemType: initial?.itemType ?? "RAW_MATERIAL",
    category: initial?.category ?? "",
    uom: initial?.uom ?? "NOS",
    hsnCode: initial?.hsnCode ?? "",
    reorderLevel: initial?.reorderLevel ?? 0,
    isBomApplicable: initial?.isBomApplicable ?? false,
  }));

  const [errors, setErrors] = React.useState<Partial<Record<keyof ItemFormValues, string>>>(
    {},
  );

  React.useEffect(() => {
    if (!props.open) return;
    setValues({
      itemCode: initial?.itemCode ?? "",
      itemName: initial?.itemName ?? "",
      itemType: initial?.itemType ?? "RAW_MATERIAL",
      category: initial?.category ?? "",
      uom: initial?.uom ?? "NOS",
      hsnCode: initial?.hsnCode ?? "",
      reorderLevel: initial?.reorderLevel ?? 0,
      isBomApplicable: initial?.isBomApplicable ?? false,
    });
    setErrors({});
  }, [initial, props.open]);

  function validate(next: ItemFormValues) {
    const e: Partial<Record<keyof ItemFormValues, string>> = {};

    if (!next.itemCode.trim()) {
      e.itemCode = "Item code is required.";
    } else {
      const code = normalize(next.itemCode);
      const duplicate = props.existingItems.some((i) => {
        if (props.mode === "edit" && initial?.id === i.id) return false;
        return normalize(i.itemCode) === code;
      });
      if (duplicate) e.itemCode = "Item code must be unique.";
    }

    if (!Number.isFinite(next.reorderLevel) || next.reorderLevel < 0) {
      e.reorderLevel = "Reorder level must be a non-negative number.";
    }

    return e;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const eMap = validate(values);
    setErrors(eMap);
    if (Object.keys(eMap).length > 0) return;
    await props.onSave({
      ...values,
      itemCode: normalize(values.itemCode),
      itemName: values.itemName.trim(),
      category: values.category.trim(),
      hsnCode: values.hsnCode.trim(),
      reorderLevel: Number(values.reorderLevel) || 0,
    });
  }

  const title = props.mode === "create" ? "Create Item" : "Edit Item";

  return (
    <FormModal
      open={props.open}
      title={title}
      description="Maintain item master data."
      onClose={props.onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="item-form" disabled={props.isSaving}>
            {props.isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <form id="item-form" className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <div className="sm:col-span-1">
          <Input
            label="Item Code (required)"
            value={values.itemCode}
            onChange={(e) => setValues((p) => ({ ...p, itemCode: e.target.value }))}
            error={errors.itemCode}
            placeholder="e.g. RM-ABS-GRAN"
            required
          />
        </div>

        <div className="sm:col-span-1">
          <Input
            label="Item Name"
            value={values.itemName}
            onChange={(e) => setValues((p) => ({ ...p, itemName: e.target.value }))}
            placeholder="e.g. ABS Granules"
          />
        </div>

        <div className="sm:col-span-1 space-y-1">
          <label className="block text-sm font-medium text-stone-700">Item Type</label>
          <select
            value={values.itemType}
            onChange={(e) => setValues((p) => ({ ...p, itemType: e.target.value as ItemType }))}
            className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 ring-1 ring-inset ring-stone-200 focus:ring-2 focus:ring-stone-400"
          >
            {itemTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <Input
            label="Category"
            value={values.category}
            onChange={(e) => setValues((p) => ({ ...p, category: e.target.value }))}
            placeholder="e.g. Polymers"
          />
        </div>

        <div className="sm:col-span-1 space-y-1">
          <label className="block text-sm font-medium text-stone-700">UOM</label>
          <select
            value={values.uom}
            onChange={(e) => setValues((p) => ({ ...p, uom: e.target.value as Item["uom"] }))}
            className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 ring-1 ring-inset ring-stone-200 focus:ring-2 focus:ring-stone-400"
          >
            {uoms.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <Input
            label="HSN Code"
            value={values.hsnCode}
            onChange={(e) => setValues((p) => ({ ...p, hsnCode: e.target.value }))}
            placeholder="e.g. 3903"
          />
        </div>

        <div className="sm:col-span-1">
          <Input
            label="Reorder Level"
            type="number"
            value={String(values.reorderLevel)}
            onChange={(e) =>
              setValues((p) => ({ ...p, reorderLevel: Number(e.target.value) }))
            }
            error={errors.reorderLevel}
            min={0}
          />
        </div>

        <div className="sm:col-span-1 flex items-center gap-2 pt-6">
          <input
            id="bomApplicable"
            type="checkbox"
            className="size-4 rounded border-stone-300"
            checked={values.isBomApplicable}
            onChange={(e) => setValues((p) => ({ ...p, isBomApplicable: e.target.checked }))}
          />
          <label htmlFor="bomApplicable" className="text-sm text-stone-700">
            BOM Applicable
          </label>
        </div>
      </form>
    </FormModal>
  );
}

