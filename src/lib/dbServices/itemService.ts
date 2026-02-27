import type { Item } from "@/lib/types";
import type { ItemService } from "@/lib/services/itemService";
import type { GetItemsParams } from "@/lib/types";
import { assertNoError, mapDbItemType, mapAppItemType, getClient, retryQuery } from "./_helpers";

// TODO: The DB items table does not yet have an is_bom_applicable column.
// Add ALTER TABLE items ADD COLUMN is_bom_applicable BOOLEAN NOT NULL DEFAULT FALSE;
// to your migration when ready. Until then this field defaults to false.

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

export const dbItemService: ItemService = {
  async getItems(_params?: GetItemsParams) {
    return retryQuery(async () => {
      const { data, error } = await getClient()
        .from("items")
        .select("id, code, name, item_type, category, uom, hsn_code, reorder_level, is_active, created_at")
        .order("code", { ascending: true });
      assertNoError(error);
      return (data ?? []).map(toItem);
    });
  },

  async createItem(input) {
    const { data, error } = await getClient()
      .from("items")
      .insert({
        code: input.itemCode.trim().toUpperCase(),
        name: input.itemName.trim(),
        item_type: mapAppItemType(input.itemType),
        category: input.category?.trim() ?? "",
        uom: input.uom,
        hsn_code: input.hsnCode?.trim() ?? "",
        reorder_level: input.reorderLevel ?? 0,
        is_active: input.isActive ?? true,
      })
      .select()
      .single();
    if (error?.code === "23505") throw new Error("Item code already exists.");
    assertNoError(error);
    return toItem(data);
  },

  async updateItem(id, patch) {
    const update: Record<string, unknown> = {};
    if (patch.itemCode !== undefined) update.code = patch.itemCode.trim().toUpperCase();
    if (patch.itemName !== undefined) update.name = patch.itemName.trim();
    if (patch.itemType !== undefined) update.item_type = mapAppItemType(patch.itemType);
    if (patch.category !== undefined) update.category = patch.category.trim();
    if (patch.uom !== undefined) update.uom = patch.uom;
    if (patch.hsnCode !== undefined) update.hsn_code = patch.hsnCode.trim();
    if (patch.reorderLevel !== undefined) update.reorder_level = patch.reorderLevel;
    if (patch.isActive !== undefined) update.is_active = patch.isActive;

    const { data, error } = await getClient()
      .from("items")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error?.code === "23505") throw new Error("Item code already exists.");
    assertNoError(error);
    if (!data) throw new Error("Item not found.");
    return toItem(data);
  },

  async toggleItemStatus(id) {
    const { data: current, error: fetchError } = await getClient()
      .from("items")
      .select("is_active")
      .eq("id", id)
      .single();
    if (fetchError || !current) throw new Error("Item not found.");

    const { data, error } = await getClient()
      .from("items")
      .update({ is_active: !current.is_active })
      .eq("id", id)
      .select()
      .single();
    assertNoError(error);
    return toItem(data);
  },
};
