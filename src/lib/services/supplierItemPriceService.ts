import type { SupplierItemPrice } from "@/lib/types";
import { dbSupplierItemPriceService } from "@/lib/dbServices/supplierItemPriceService";
import { logAudit } from "@/lib/auditLogger";

export type RankedSupplier = SupplierItemPrice & {
  rank: number;
  label: string;
  landedPrice: number;
  totalCost: number | null;
};

export type CreateSIPInput = {
  supplierId: string;
  itemId: string;
  unitPrice: number;
  taxPercent: number;
  leadTimeDays: number;
  minOrderQty?: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  remarks?: string;
};

export type UpdateSIPInput = Partial<{
  unitPrice: number;
  taxPercent: number;
  leadTimeDays: number;
  minOrderQty: number;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  remarks: string;
}>;

type Actor = { id: string; name: string };

export type SupplierItemPriceService = {
  getAll: () => Promise<SupplierItemPrice[]>;
  getBySupplier: (supplierId: string) => Promise<SupplierItemPrice[]>;
  getByItem: (itemId: string) => Promise<SupplierItemPrice[]>;
  getById: (id: string) => Promise<SupplierItemPrice | null>;
  create: (input: CreateSIPInput, actor?: Actor) => Promise<SupplierItemPrice>;
  update: (id: string, patch: UpdateSIPInput, actor?: Actor) => Promise<SupplierItemPrice>;
  remove: (id: string, actor?: Actor) => Promise<void>;
  getRankedSuppliers: (itemId: string, quantity?: number) => Promise<RankedSupplier[]>;
  getForRfqAutoFill: (itemIds: string[], supplierIds: string[]) => Promise<SupplierItemPrice[]>;
};

export const supplierItemPriceService: SupplierItemPriceService = {
  getAll: () => dbSupplierItemPriceService.getAll(),
  getBySupplier: (supplierId) => dbSupplierItemPriceService.getBySupplier(supplierId),
  getByItem: (itemId) => dbSupplierItemPriceService.getByItem(itemId),
  getById: (id) => dbSupplierItemPriceService.getById(id),
  getForRfqAutoFill: (itemIds, supplierIds) => dbSupplierItemPriceService.getForRfqAutoFill(itemIds, supplierIds),
  getRankedSuppliers: (itemId, quantity) => dbSupplierItemPriceService.getRankedSuppliers(itemId, quantity),

  async create(input, actor) {
    if (!input.supplierId) throw new Error("Supplier is required.");
    if (!input.itemId) throw new Error("Item is required.");
    if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) throw new Error("Unit price must be >= 0.");
    if (!Number.isFinite(input.taxPercent) || input.taxPercent < 0 || input.taxPercent > 100) throw new Error("Tax % must be 0–100.");

    const sip = await dbSupplierItemPriceService.create(input);
    if (actor) {
      logAudit({
        userId: actor.id, userName: actor.name,
        action: "CREATE", module: "Suppliers",
        entityId: sip.id, entityType: "SupplierItemPrice",
        details: { supplierId: input.supplierId, itemId: input.itemId, unitPrice: input.unitPrice },
      });
    }
    return sip;
  },

  async update(id, patch, actor) {
    const sip = await dbSupplierItemPriceService.update(id, patch);
    if (actor) {
      logAudit({
        userId: actor.id, userName: actor.name,
        action: "UPDATE", module: "Suppliers",
        entityId: id, entityType: "SupplierItemPrice",
        details: { updatedFields: Object.keys(patch) },
      });
    }
    return sip;
  },

  async remove(id, actor) {
    await dbSupplierItemPriceService.remove(id);
    if (actor) {
      logAudit({
        userId: actor.id, userName: actor.name,
        action: "DELETE", module: "Suppliers",
        entityId: id, entityType: "SupplierItemPrice",
      });
    }
  },
};
