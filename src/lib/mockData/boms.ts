import type { BOM, BOMItem, Item } from "@/lib/types";
import { getItems } from "@/lib/mockData/items";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  // Logic correction: safer IDs to avoid collisions in mock store.
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}_${uuid}`
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeBomCode(code: string) {
  return code.trim().toUpperCase();
}

type BomLineInput = {
  rawMaterialItemId: string;
  quantityPerUnit: number;
  scrapPercentage: number;
};

let bomsStore: BOM[] = [
  {
    id: "bom_001",
    bomCode: "BOM-FG-SAFETY-GLOVE-A",
    finishedGoodItemId: "i_fg_gloves",
    version: 1,
    isActive: true,
    createdAt: "2026-02-10T08:00:00.000Z",
  },
];

let bomItemsStore: BOMItem[] = [
  {
    id: "bomi_001",
    bomId: "bom_001",
    rawMaterialItemId: "i_rm_abs_granules",
    quantityPerUnit: 0.12,
    scrapPercentage: 2,
  },
  {
    id: "bomi_002",
    bomId: "bom_001",
    rawMaterialItemId: "i_pm_box_small",
    quantityPerUnit: 1,
    scrapPercentage: 0,
  },
];

export async function getItemsForBOM(): Promise<Item[]> {
  await sleep(150);
  const items = await getItems();
  return items.filter(
    (i) =>
      i.isActive &&
      (i.itemType === "RAW_MATERIAL" || i.itemType === "SEMI_FINISHED"),
  );
}

export async function getBOMs(params?: { delayMs?: number }): Promise<BOM[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  return [...bomsStore].sort((a, b) => {
    if (a.bomCode !== b.bomCode) return a.bomCode.localeCompare(b.bomCode);
    return b.version - a.version;
  });
}

export async function getBOMById(bomId: string): Promise<BOM | null> {
  await sleep(120);
  return bomsStore.find((b) => b.id === bomId) ?? null;
}

export async function getBOMItems(bomId: string): Promise<BOMItem[]> {
  await sleep(120);
  return bomItemsStore.filter((l) => l.bomId === bomId);
}

export async function getActiveBOMForFinishedGood(
  finishedGoodItemId: string,
): Promise<BOM | null> {
  await sleep(120);
  const active = bomsStore
    .filter((b) => b.finishedGoodItemId === finishedGoodItemId && b.isActive)
    .sort((a, b) => b.version - a.version)[0];
  return active ?? null;
}

function nextVersionFor(bomCode: string) {
  const versions = bomsStore
    .filter((b) => normalizeBomCode(b.bomCode) === normalizeBomCode(bomCode))
    .map((b) => b.version);
  return versions.length ? Math.max(...versions) + 1 : 1;
}

function deactivateActiveForCode(bomCode: string) {
  bomsStore = bomsStore.map((b) =>
    normalizeBomCode(b.bomCode) === normalizeBomCode(bomCode)
      ? { ...b, isActive: false }
      : b,
  );
}

function validateLines(lines: BomLineInput[]) {
  if (lines.length === 0) throw new Error("At least one BOM item is required.");
  const ids = lines.map((l) => l.rawMaterialItemId).filter(Boolean);
  const uniq = new Set(ids);
  if (uniq.size !== ids.length) {
    throw new Error("Duplicate raw materials are not allowed in a BOM.");
  }
  for (const l of lines) {
    if (!l.rawMaterialItemId) throw new Error("Raw material is required.");
    if (!Number.isFinite(l.quantityPerUnit) || l.quantityPerUnit <= 0) {
      throw new Error("Quantity per unit must be greater than 0.");
    }
    if (!Number.isFinite(l.scrapPercentage) || l.scrapPercentage < 0 || l.scrapPercentage > 100) {
      throw new Error("Scrap percentage must be between 0 and 100.");
    }
  }
}

export async function createBOM(input: {
  bomCode: string;
  finishedGoodItemId: string;
  lines: BomLineInput[];
}): Promise<BOM> {
  await sleep(400);
  validateLines(input.lines);

  const bomCode = normalizeBomCode(input.bomCode);
  const version = nextVersionFor(bomCode);

  // Ensure one active version per BOM code.
  deactivateActiveForCode(bomCode);

  const bom: BOM = {
    id: genId("bom"),
    bomCode,
    finishedGoodItemId: input.finishedGoodItemId,
    version,
    isActive: true,
    createdAt: nowIso(),
  };

  const lines: BOMItem[] = input.lines.map((l) => ({
    id: genId("bomi"),
    bomId: bom.id,
    rawMaterialItemId: l.rawMaterialItemId,
    quantityPerUnit: Number(l.quantityPerUnit),
    scrapPercentage: clamp(Number(l.scrapPercentage), 0, 100),
  }));

  bomsStore = [bom, ...bomsStore];
  bomItemsStore = [...lines, ...bomItemsStore];
  return bom;
}

export async function updateBOM(input: {
  bomId: string;
  lines: BomLineInput[];
}): Promise<BOM> {
  await sleep(450);
  validateLines(input.lines);

  const prev = bomsStore.find((b) => b.id === input.bomId);
  if (!prev) throw new Error("BOM not found.");

  // New version is created automatically; previous versions remain read-only.
  const bomCode = normalizeBomCode(prev.bomCode);
  const version = nextVersionFor(bomCode);
  deactivateActiveForCode(bomCode);

  const bom: BOM = {
    id: genId("bom"),
    bomCode,
    finishedGoodItemId: prev.finishedGoodItemId,
    version,
    isActive: true,
    createdAt: nowIso(),
  };

  const lines: BOMItem[] = input.lines.map((l) => ({
    id: genId("bomi"),
    bomId: bom.id,
    rawMaterialItemId: l.rawMaterialItemId,
    quantityPerUnit: Number(l.quantityPerUnit),
    scrapPercentage: clamp(Number(l.scrapPercentage), 0, 100),
  }));

  bomsStore = [bom, ...bomsStore];
  bomItemsStore = [...lines, ...bomItemsStore];
  return bom;
}

export async function deactivateBOM(bomId: string): Promise<BOM> {
  await sleep(300);
  const bom = bomsStore.find((b) => b.id === bomId);
  if (!bom) throw new Error("BOM not found.");
  const next = { ...bom, isActive: false };
  bomsStore = bomsStore.map((b) => (b.id === bomId ? next : b));
  return next;
}

