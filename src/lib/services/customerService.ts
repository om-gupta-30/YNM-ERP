import type { Customer } from "@/lib/types";
import type { GetCustomersParams } from "@/lib/types";
import { dbCustomerService } from "@/lib/dbServices/customerService";
import { logAudit } from "@/lib/auditLogger";
import { checkCustomerDependencies, formatDependencyError } from "@/lib/dbServices/integrityChecks";

export type CustomerService = {
  getCustomers: (params?: GetCustomersParams) => Promise<Customer[]>;
  createCustomer: (
    input: Omit<Customer, "id" | "isActive" | "createdAt"> &
      Partial<Pick<Customer, "isActive" | "createdAt">>,
    actor?: { id: string; name: string },
  ) => Promise<Customer>;
  updateCustomer: (
    id: string,
    patch: Partial<Omit<Customer, "id" | "createdAt">>,
    actor?: { id: string; name: string },
  ) => Promise<Customer>;
  toggleCustomerStatus: (id: string, actor?: { id: string; name: string }) => Promise<Customer>;
};

export const customerService: CustomerService = {
  async getCustomers(params) {
    return dbCustomerService.getCustomers(params);
  },
  async createCustomer(input, actor) {
    const customer = await dbCustomerService.createCustomer(input);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "CREATE",
        module: "Customers",
        entityId: customer.id,
        entityType: "Customer",
        details: { customerCode: customer.customerCode, customerName: customer.customerName },
      });
    }
    return customer;
  },
  async updateCustomer(id, patch, actor) {
    const customer = await dbCustomerService.updateCustomer(id, patch);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "UPDATE",
        module: "Customers",
        entityId: id,
        entityType: "Customer",
        details: { updatedFields: Object.keys(patch) },
      });
    }
    return customer;
  },
  async toggleCustomerStatus(id, actor) {
    const current = await dbCustomerService.getCustomers();
    const target = current.find((c) => c.id === id);
    if (target?.isActive) {
      const deps = await checkCustomerDependencies(id);
      if (deps.length > 0) {
        throw new Error(formatDependencyError(target.customerName || "this customer", deps));
      }
    }

    const customer = await dbCustomerService.toggleCustomerStatus(id);
    if (actor) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "STATUS_CHANGE",
        module: "Customers",
        entityId: id,
        entityType: "Customer",
        details: { isActive: customer.isActive },
      });
    }
    return customer;
  },
};
