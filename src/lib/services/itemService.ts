import type { Item } from "@/lib/types";
import type { GetItemsParams } from "@/lib/types";
import { dbItemService } from "@/lib/dbServices/itemService";
import { logAudit } from "@/lib/auditLogger";
import { checkItemDependencies, formatDependencyError } from "@/lib/dbServices/integrityChecks";

export type ItemService = {
  getItems: (params?: GetItemsParams) => Promise<Item[]>;
  createItem: (
    input: Omit<Item, "id" | "isActive" | "createdAt"> &
      Partial<Pick<Item, "isActive" | "createdAt">>,
    actor?: { id: string; name: string },
  ) => Promise<Item>;
  updateItem: (
    id: string,
    patch: Partial<Omit<Item, "id" | "createdAt">>,
    actor?: { id: string; name: string },
  ) => Promise<Item>;
  toggleItemStatus: (id: string, actor?: { id: string; name: string }) => Promise<Item>;
};

export const itemService: ItemService = {
  async getItems(params) {
    return dbItemService.getItems(params);
  },
  async createItem(input, actor) {
    const item = await dbItemService.createItem(input);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "CREATE",
        module: "Items",
        entityId: item.id,
        entityType: "Item",
        details: { itemCode: item.itemCode, itemName: item.itemName, itemType: item.itemType },
      });
    }
    return item;
  },
  async updateItem(id, patch, actor) {
    const item = await dbItemService.updateItem(id, patch);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "UPDATE",
        module: "Items",
        entityId: id,
        entityType: "Item",
        details: { updatedFields: Object.keys(patch) },
      });
    }
    return item;
  },
  async toggleItemStatus(id, actor) {
    // Before deactivating, check for active dependencies
    const current = await dbItemService.getItems();
    const target = current.find((i) => i.id === id);
    if (target?.isActive) {
      const deps = await checkItemDependencies(id);
      if (deps.length > 0) {
        throw new Error(formatDependencyError(target.itemName || "this item", deps));
      }
    }

    const item = await dbItemService.toggleItemStatus(id);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "STATUS_CHANGE",
        module: "Items",
        entityId: id,
        entityType: "Item",
        details: { isActive: item.isActive },
      });
    }
    return item;
  },
};
