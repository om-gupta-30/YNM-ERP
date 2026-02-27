import type { Item } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}_${uuid}`
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

let itemsStore: Item[] = [
  {
    id: "i_rm_steel_rod",
    itemCode: "RM-STEEL-ROD-10MM",
    itemName: "Steel Rod 10mm",
    itemType: "RAW_MATERIAL",
    category: "Metals",
    uom: "MTR",
    hsnCode: "7214",
    reorderLevel: 250,
    isBomApplicable: false,
    isActive: true,
    createdAt: "2026-02-01T09:00:00.000Z",
  },
  {
    id: "i_rm_abs_granules",
    itemCode: "RM-ABS-GRAN",
    itemName: "ABS Granules",
    itemType: "RAW_MATERIAL",
    category: "Polymers",
    uom: "KG",
    hsnCode: "3903",
    reorderLevel: 500,
    isBomApplicable: false,
    isActive: true,
    createdAt: "2026-02-01T09:05:00.000Z",
  },
  {
    id: "i_pm_box_small",
    itemCode: "PM-BOX-S",
    itemName: "Packaging Box (Small)",
    itemType: "TRADING",
    category: "Packaging",
    uom: "NOS",
    hsnCode: "4819",
    reorderLevel: 1000,
    isBomApplicable: false,
    isActive: true,
    createdAt: "2026-02-01T09:10:00.000Z",
  },
  {
    id: "i_fg_gloves",
    itemCode: "FG-SAFETY-GLOVE-A",
    itemName: "Safety Gloves - Model A",
    itemType: "FINISHED_GOOD",
    category: "PPE",
    uom: "NOS",
    hsnCode: "6116",
    reorderLevel: 200,
    isBomApplicable: true,
    isActive: true,
    createdAt: "2026-02-01T09:15:00.000Z",
  },
  {
    id: "i_sfg_shell",
    itemCode: "SFG-HELMET-SHELL",
    itemName: "Helmet Shell (SFG)",
    itemType: "SEMI_FINISHED",
    category: "Components",
    uom: "NOS",
    hsnCode: "6506",
    reorderLevel: 300,
    isBomApplicable: true,
    isActive: true,
    createdAt: "2026-02-01T09:20:00.000Z",
  },
];

export type GetItemsParams = {
  delayMs?: number;
};

export async function getItems(params?: GetItemsParams): Promise<Item[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  return [...itemsStore].sort((a, b) => a.itemCode.localeCompare(b.itemCode));
}

export async function createItem(input: Omit<Item, "id" | "isActive" | "createdAt"> & Partial<Pick<Item, "isActive" | "createdAt">>) {
  await sleep(350);
  const itemCode = normalizeCode(input.itemCode);
  const exists = itemsStore.some((i) => normalizeCode(i.itemCode) === itemCode);
  if (exists) throw new Error("Item code already exists.");

  const item: Item = {
    // Logic correction: safer IDs to avoid collisions in mock store.
    id: genId("i"),
    itemCode,
    itemName: input.itemName?.trim() ?? "",
    itemType: input.itemType,
    category: input.category?.trim() ?? "",
    uom: input.uom,
    hsnCode: input.hsnCode?.trim() ?? "",
    reorderLevel: Number.isFinite(input.reorderLevel) ? Number(input.reorderLevel) : 0,
    isBomApplicable: Boolean(input.isBomApplicable),
    isActive: input.isActive ?? true,
    createdAt: input.createdAt ?? nowIso(),
  };

  itemsStore = [item, ...itemsStore];
  return item;
}

export async function updateItem(id: string, patch: Partial<Omit<Item, "id" | "createdAt">>) {
  await sleep(350);
  const idx = itemsStore.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error("Item not found.");

  const next: Item = { ...itemsStore[idx], ...patch };
  if (patch.itemCode) next.itemCode = normalizeCode(patch.itemCode);

  const dup = itemsStore.some(
    (i) => i.id !== id && normalizeCode(i.itemCode) === normalizeCode(next.itemCode),
  );
  if (dup) throw new Error("Item code already exists.");

  itemsStore = itemsStore.map((i) => (i.id === id ? next : i));
  return next;
}

export async function toggleItemStatus(id: string) {
  await sleep(300);
  const item = itemsStore.find((i) => i.id === id);
  if (!item) throw new Error("Item not found.");
  const next = { ...item, isActive: !item.isActive };
  itemsStore = itemsStore.map((i) => (i.id === id ? next : i));
  return next;
}

