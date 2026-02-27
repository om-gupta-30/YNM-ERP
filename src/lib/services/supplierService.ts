import type { Supplier } from "@/lib/types";
import type { GetSuppliersParams } from "@/lib/types";
import { dbSupplierService } from "@/lib/dbServices/supplierService";
import { logAudit } from "@/lib/auditLogger";
import { checkSupplierDependencies, formatDependencyError } from "@/lib/dbServices/integrityChecks";

export type SupplierService = {
  getSuppliers: (params?: GetSuppliersParams) => Promise<Supplier[]>;
  createSupplier: (
    input: Omit<Supplier, "id" | "isActive" | "createdAt"> &
      Partial<Pick<Supplier, "isActive" | "createdAt">>,
    actor?: { id: string; name: string },
  ) => Promise<Supplier>;
  updateSupplier: (
    id: string,
    patch: Partial<Omit<Supplier, "id" | "createdAt">>,
    actor?: { id: string; name: string },
  ) => Promise<Supplier>;
  toggleSupplierStatus: (id: string, actor?: { id: string; name: string }) => Promise<Supplier>;
};

export const supplierService: SupplierService = {
  async getSuppliers(params) {
    return dbSupplierService.getSuppliers(params);
  },
  async createSupplier(input, actor) {
    const supplier = await dbSupplierService.createSupplier(input);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "CREATE",
        module: "Suppliers",
        entityId: supplier.id,
        entityType: "Supplier",
        details: { supplierCode: supplier.supplierCode, supplierName: supplier.supplierName },
      });
    }
    return supplier;
  },
  async updateSupplier(id, patch, actor) {
    const supplier = await dbSupplierService.updateSupplier(id, patch);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "UPDATE",
        module: "Suppliers",
        entityId: id,
        entityType: "Supplier",
        details: { updatedFields: Object.keys(patch) },
      });
    }
    return supplier;
  },
  async toggleSupplierStatus(id, actor) {
    const current = await dbSupplierService.getSuppliers();
    const target = current.find((s) => s.id === id);
    if (target?.isActive) {
      const deps = await checkSupplierDependencies(id);
      if (deps.length > 0) {
        throw new Error(formatDependencyError(target.supplierName || "this supplier", deps));
      }
    }

    const supplier = await dbSupplierService.toggleSupplierStatus(id);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "STATUS_CHANGE",
        module: "Suppliers",
        entityId: id,
        entityType: "Supplier",
        details: { isActive: supplier.isActive },
      });
    }
    return supplier;
  },
};
