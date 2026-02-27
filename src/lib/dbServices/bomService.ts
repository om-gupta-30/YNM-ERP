import type { BOM, BOMItem, Item } from "@/lib/types";
import type { BomService } from "@/lib/services/bomService";
import { assertNoError, getClient, mapDbItemType, retryQuery } from "./_helpers";

// ---- Schema mapping notes ----
// bom_master.description   → BOM.bomCode  (no dedicated bom_code column in schema)
// bom_master.version TEXT  → BOM.version number  (stored as "1","2","3" …)
// bom_master.status        → BOM.isActive  ('active' = true, others = false)
// bom_items.component_item_id → BOMItem.rawMaterialItemId
// bom_items.quantity       → BOMItem.quantityPerUnit
// bom_items.scrap_percent  → BOMItem.scrapPercentage
//
// Versioning rule (matches mock):
//   Creating / updating a BOM always inserts a NEW bom_master row with an
//   incremented version and sets all prior active rows for that
//   (finished_item_id, bomCode) to status='obsolete'. Old rows are
//   read-only — bom_items are never mutated.
//
// DB unique constraint: UNIQUE (finished_item_id, version)
// Since version is scoped per finished_item_id, the sequence is global for
// that item (not per bomCode). In practice each finished good has one BOM
// code, so this is equivalent to per-code versioning.

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ---- Row mappers ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBOM(row: Record<string, any>): BOM {
  return {
    id: row.id as string,
    bomCode: (row.description as string) ?? "",
    finishedGoodItemId: row.finished_item_id as string,
    version: Number(row.version) || 1,
    isActive: row.status === "active",
    createdAt: row.created_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBOMItem(row: Record<string, any>): BOMItem {
  return {
    id: row.id as string,
    bomId: row.bom_id as string,
    rawMaterialItemId: row.component_item_id as string,
    quantityPerUnit: Number(row.quantity),
    scrapPercentage: Number(row.scrap_percent ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toItem(row: Record<string, any>): Item {
  return {
    id: row.id as string,
    itemCode: row.code as string,
    itemName: row.name as string,
    itemType: mapDbItemType(row.item_type as string),
    category: (row.category as string) ?? "",
    uom: (row.uom as "NOS" | "KG" | "MTR") ?? "NOS",
    hsnCode: (row.hsn_code as string) ?? "",
    reorderLevel: Number(row.reorder_level ?? 0),
    isBomApplicable: false,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}

// ---- Versioning helpers ----

/**
 * Returns the next integer version for a given (finished_item_id, bomCode) pair.
 * Scoped to finished_item_id because the DB UNIQUE constraint is on
 * (finished_item_id, version), not on (description, version).
 */
async function getNextVersion(finishedItemId: string): Promise<number> {
  const { data } = await getClient()
    .from("bom_master")
    .select("version")
    .eq("finished_item_id", finishedItemId);
  if (!data || data.length === 0) return 1;
  const versions = data.map((r) => Number(r.version) || 0).filter(Number.isFinite);
  return versions.length ? Math.max(...versions) + 1 : 1;
}

/**
 * Sets any currently 'active' BOM rows for the same finished_item_id + bomCode
 * to 'obsolete'. Mirrors the mock's deactivateActiveForCode() behaviour.
 */
async function obsoleteActiveForCode(finishedItemId: string, bomCode: string): Promise<void> {
  await getClient()
    .from("bom_master")
    .update({ status: "obsolete" })
    .eq("finished_item_id", finishedItemId)
    .eq("description", bomCode)
    .eq("status", "active");
}

function validateLines(
  lines: Array<{
    rawMaterialItemId: string;
    quantityPerUnit: number;
    scrapPercentage: number;
  }>,
) {
  if (lines.length === 0) throw new Error("At least one BOM item is required.");
  const ids = lines.map((l) => l.rawMaterialItemId).filter(Boolean);
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate raw materials are not allowed in a BOM.");
  for (const l of lines) {
    if (!l.rawMaterialItemId) throw new Error("Raw material is required.");
    if (!Number.isFinite(l.quantityPerUnit) || l.quantityPerUnit <= 0)
      throw new Error("Quantity per unit must be greater than 0.");
    if (
      !Number.isFinite(l.scrapPercentage) ||
      l.scrapPercentage < 0 ||
      l.scrapPercentage > 100
    )
      throw new Error("Scrap percentage must be between 0 and 100.");
  }
}

async function insertBOMWithLines(
  finishedItemId: string,
  bomCode: string,
  version: number,
  lines: Array<{
    rawMaterialItemId: string;
    quantityPerUnit: number;
    scrapPercentage: number;
  }>,
  actorId?: string | null,
): Promise<BOM> {
  const { data: bom, error: bomError } = await getClient()
    .from("bom_master")
    .insert({
      finished_item_id: finishedItemId,
      description: bomCode,
      version: String(version),
      status: "active",
      created_by: actorId ?? null,
    })
    .select()
    .single();
  assertNoError(bomError);

  const bomItems = lines.map((l) => ({
    bom_id: bom.id,
    component_item_id: l.rawMaterialItemId,
    quantity: Number(l.quantityPerUnit),
    uom: "NOS",
    scrap_percent: clamp(Number(l.scrapPercentage), 0, 100),
  }));
  const { error: itemsError } = await getClient()
    .from("bom_items")
    .insert(bomItems);
  assertNoError(itemsError);

  return toBOM(bom);
}

// ---- Service ----

export const dbBomService: BomService = {
  async getItemsForBOM() {
    const { data, error } = await getClient()
      .from("items")
      .select("*")
      .in("item_type", ["raw_material", "semi_finished"])
      .eq("is_active", true)
      .order("code", { ascending: true });
    assertNoError(error);
    return (data ?? []).map(toItem);
  },

  async getBOMs(_params?) {
    return retryQuery(async () => {
      const { data, error } = await getClient()
        .from("bom_master")
        .select("*")
        .order("description", { ascending: true })
        .order("created_at", { ascending: false });
      assertNoError(error);
      return (data ?? []).map(toBOM);
    });
  },

  async getBOMById(bomId) {
    const { data, error } = await getClient()
      .from("bom_master")
      .select("*")
      .eq("id", bomId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    return toBOM(data);
  },

  async getBOMItems(bomId) {
    const { data, error } = await getClient()
      .from("bom_items")
      .select("*")
      .eq("bom_id", bomId);
    assertNoError(error);
    return (data ?? []).map(toBOMItem);
  },

  async getActiveBOMForFinishedGood(finishedGoodItemId) {
    const { data, error } = await getClient()
      .from("bom_master")
      .select("*")
      .eq("finished_item_id", finishedGoodItemId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    return toBOM(data);
  },

  async createBOM(input, actor) {
    validateLines(input.lines);
    const bomCode = input.bomCode.trim().toUpperCase();

    const version = await getNextVersion(input.finishedGoodItemId);
    await obsoleteActiveForCode(input.finishedGoodItemId, bomCode);

    return insertBOMWithLines(input.finishedGoodItemId, bomCode, version, input.lines, actor?.id);
  },

  async updateBOM(input) {
    validateLines(input.lines);

    const prev = await dbBomService.getBOMById(input.bomId);
    if (!prev) throw new Error("BOM not found.");

    const version = await getNextVersion(prev.finishedGoodItemId);
    await obsoleteActiveForCode(prev.finishedGoodItemId, prev.bomCode);

    return insertBOMWithLines(prev.finishedGoodItemId, prev.bomCode, version, input.lines);
  },

  async deactivateBOM(bomId) {
    const { data, error } = await getClient()
      .from("bom_master")
      .update({ status: "obsolete" })
      .eq("id", bomId)
      .select()
      .single();
    assertNoError(error);
    if (!data) throw new Error("BOM not found.");
    return toBOM(data);
  },
};
