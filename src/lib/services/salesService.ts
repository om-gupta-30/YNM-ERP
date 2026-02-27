import type { Dispatch, DispatchItem, FactoryCode, Invoice, SalesOrder, SalesOrderItem } from "@/lib/types";
import { dbSalesService } from "@/lib/dbServices/salesService";
import { logAudit } from "@/lib/auditLogger";

type Actor = { id: string; name: string; factory?: FactoryCode };

export type SalesService = {
  getSalesOrders: (params?: { delayMs?: number; factory?: FactoryCode }) => Promise<SalesOrder[]>;
  getSalesOrderById: (soId: string) => Promise<SalesOrder | null>;
  getSalesOrderItems: (soId: string) => Promise<SalesOrderItem[]>;
  createSalesOrder: (input: {
    customerId: string;
    orderDate?: string;
    items: Array<{ itemId: string; quantity: number; rate: number }>;
    factory?: FactoryCode;
  }, actor?: Actor) => Promise<SalesOrder>;

  getDispatches: (params?: { delayMs?: number; factory?: FactoryCode }) => Promise<Dispatch[]>;
  getDispatchById: (dispatchId: string) => Promise<Dispatch | null>;
  getDispatchItems: (dispatchId: string) => Promise<DispatchItem[]>;
  createDispatch: (input: { soId: string; dispatchDate?: string; factory?: FactoryCode }, actor?: Actor) => Promise<Dispatch>;
  dispatchGoods: (input: {
    dispatchId: string;
    items: Array<{ itemId: string; quantityDispatched: number }>;
  }, actor?: Actor) => Promise<Dispatch>;

  getInvoices: (params?: { delayMs?: number; factory?: FactoryCode }) => Promise<Invoice[]>;
  getInvoiceByDispatchId: (dispatchId: string) => Promise<Invoice | null>;
  generateInvoice: (input: { dispatchId: string }, actor?: Actor) => Promise<Invoice>;
};

function audit(actor: Actor | undefined, action: string, module: string, entityId: string, entityType: string, details?: Record<string, unknown>) {
  if (!actor) return;
  logAudit({
    userId: actor.id,
    userName: actor.name,
    action: action as "CREATE",
    module: module as "Sales Order",
    entityId,
    entityType,
    factory: actor.factory,
    details,
  });
}

export const salesService: SalesService = {
  getSalesOrders:        (params)     => dbSalesService.getSalesOrders(params),
  getSalesOrderById:     (soId)       => dbSalesService.getSalesOrderById(soId),
  getSalesOrderItems:    (soId)       => dbSalesService.getSalesOrderItems(soId),
  getDispatches:         (params)     => dbSalesService.getDispatches(params),
  getDispatchById:       (dispatchId) => dbSalesService.getDispatchById(dispatchId),
  getDispatchItems:      (dispatchId) => dbSalesService.getDispatchItems(dispatchId),
  getInvoices:           (params)     => dbSalesService.getInvoices(params),
  getInvoiceByDispatchId:(dispatchId) => dbSalesService.getInvoiceByDispatchId(dispatchId),

  async createSalesOrder(input, actor) {
    const so = await dbSalesService.createSalesOrder(input, actor);
    audit(actor, "CREATE", "Sales Order", so.id, "SalesOrder", { soNumber: so.soNumber, customerId: input.customerId, itemCount: input.items.length });
    return so;
  },

  async createDispatch(input, actor) {
    const dispatch = await dbSalesService.createDispatch(input, actor);
    audit(actor, "CREATE", "Dispatch", dispatch.id, "Dispatch", { dispatchNumber: dispatch.dispatchNumber, soId: input.soId });
    return dispatch;
  },

  async dispatchGoods(input, actor) {
    const dispatch = await dbSalesService.dispatchGoods(input, actor);
    audit(actor, "STATUS_CHANGE", "Dispatch", input.dispatchId, "Dispatch", { dispatchNumber: dispatch.dispatchNumber, status: dispatch.status });
    return dispatch;
  },

  async generateInvoice(input, actor) {
    const invoice = await dbSalesService.generateInvoice(input, actor);
    audit(actor, "CREATE", "Invoice", invoice.id, "Invoice", {
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount,
      taxAmount: invoice.taxAmount,
    });
    return invoice;
  },
};
