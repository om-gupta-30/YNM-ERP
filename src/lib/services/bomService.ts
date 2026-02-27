import type { BOM, BOMItem, Item } from "@/lib/types";
import { dbBomService } from "@/lib/dbServices/bomService";
import { logAudit } from "@/lib/auditLogger";
import { checkBomDependencies, formatDependencyError } from "@/lib/dbServices/integrityChecks";

export type BomService = {
  getItemsForBOM: () => Promise<Item[]>;
  getBOMs: (params?: { delayMs?: number }) => Promise<BOM[]>;
  getBOMById: (bomId: string) => Promise<BOM | null>;
  getBOMItems: (bomId: string) => Promise<BOMItem[]>;
  getActiveBOMForFinishedGood: (finishedGoodItemId: string) => Promise<BOM | null>;
  createBOM: (
    input: {
      bomCode: string;
      finishedGoodItemId: string;
      lines: Array<{ rawMaterialItemId: string; quantityPerUnit: number; scrapPercentage: number }>;
    },
    actor?: { id: string; name: string },
  ) => Promise<BOM>;
  updateBOM: (
    input: {
      bomId: string;
      lines: Array<{ rawMaterialItemId: string; quantityPerUnit: number; scrapPercentage: number }>;
    },
    actor?: { id: string; name: string },
  ) => Promise<BOM>;
  deactivateBOM: (bomId: string, actor?: { id: string; name: string }) => Promise<BOM>;
};

export const bomService: BomService = {
  getItemsForBOM: () => dbBomService.getItemsForBOM(),
  getBOMs: (params?) => dbBomService.getBOMs(params),
  getBOMById: (bomId) => dbBomService.getBOMById(bomId),
  getBOMItems: (bomId) => dbBomService.getBOMItems(bomId),
  getActiveBOMForFinishedGood: (id) => dbBomService.getActiveBOMForFinishedGood(id),

  async createBOM(input, actor) {
    const bom = await dbBomService.createBOM(input, actor);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "CREATE",
        module: "BOM",
        entityId: bom.id,
        entityType: "BOM",
        details: { bomCode: bom.bomCode, lineCount: input.lines.length },
      });
    }
    return bom;
  },

  async updateBOM(input, actor) {
    const bom = await dbBomService.updateBOM(input);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "UPDATE",
        module: "BOM",
        entityId: input.bomId,
        entityType: "BOM",
        details: { lineCount: input.lines.length },
      });
    }
    return bom;
  },

  async deactivateBOM(bomId, actor) {
    const deps = await checkBomDependencies(bomId);
    if (deps.length > 0) {
      const existing = await dbBomService.getBOMById(bomId);
      throw new Error(formatDependencyError(existing?.bomCode || "this BOM", deps));
    }

    const bom = await dbBomService.deactivateBOM(bomId);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "DELETE",
        module: "BOM",
        entityId: bomId,
        entityType: "BOM",
        details: { bomCode: bom.bomCode },
      });
    }
    return bom;
  },
};
