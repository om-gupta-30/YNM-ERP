import type { FactoryCode, GateEntry, GRN, GRNItem, StockLedger } from "@/lib/types";
import { dbInventoryService } from "@/lib/dbServices/inventoryService";
import { logAudit } from "@/lib/auditLogger";

export type StockLedgerEntry = {
  itemId: string;
  transactionType: "INWARD" | "OUTWARD";
  quantity: number;
  referenceType: "GRN" | "PRODUCTION" | "DISPATCH";
  referenceId: string;
  createdAt?: string;
  factory?: FactoryCode;
};

type Actor = { id: string; name: string; factory?: FactoryCode };

export type InventoryService = {
  getGateEntries: (params?: { delayMs?: number; factory?: FactoryCode }) => Promise<GateEntry[]>;
  createGateEntry: (input: {
    poId: string;
    vehicleNumber: string;
    invoiceNumber: string;
    ewayBillNumber: string;
    factory?: FactoryCode;
  }, actor?: Actor) => Promise<GateEntry>;

  getGRNs: (params?: { delayMs?: number; factory?: FactoryCode }) => Promise<GRN[]>;
  getGRNById: (grnId: string) => Promise<GRN | null>;
  getGRNItems: (grnId: string) => Promise<GRNItem[]>;
  createGRN: (input: { gateEntryId: string }, actor?: Actor) => Promise<GRN>;
  approveGRN: (input: {
    grnId: string;
    items: Array<{ itemId: string; receivedQty: number; acceptedQty: number }>;
  }, actor?: Actor) => Promise<GRN>;
  rejectGRN: (input: { grnId: string }, actor?: Actor) => Promise<GRN>;

  getStockLedger: (params?: {
    delayMs?: number;
    itemId?: string;
    transactionType?: "INWARD" | "OUTWARD";
    factory?: FactoryCode;
  }) => Promise<StockLedger[]>;
  getCurrentStock: (params?: { factory?: FactoryCode }) => Promise<Record<string, number>>;

  getOpenPOs: (params?: { factory?: FactoryCode }) => Promise<
    Array<{ id: string; poNumber: string; supplierId: string; status: string }>
  >;

  postStockLedgerEntries: (entries: StockLedgerEntry[], actor?: Actor) => Promise<void>;
};

function audit(actor: Actor | undefined, action: string, module: string, entityId: string, entityType: string, details?: Record<string, unknown>) {
  if (!actor) return;
  logAudit({
    userId: actor.id,
    userName: actor.name,
    action: action as "CREATE",
    module: module as "Gate Entry",
    entityId,
    entityType,
    factory: actor.factory,
    details,
  });
}

export const inventoryService: InventoryService = {
  getGateEntries:  (params?) => dbInventoryService.getGateEntries(params),
  getGRNs:         (params?) => dbInventoryService.getGRNs(params),
  getGRNById:      (grnId)   => dbInventoryService.getGRNById(grnId),
  getGRNItems:     (grnId)   => dbInventoryService.getGRNItems(grnId),
  getStockLedger:  (params?) => dbInventoryService.getStockLedger(params),
  getCurrentStock: (params?) => dbInventoryService.getCurrentStock(params),
  getOpenPOs:      (params?) => dbInventoryService.getOpenPOs(params),

  async createGateEntry(input, actor) {
    const ge = await dbInventoryService.createGateEntry(input, actor);
    audit(actor, "CREATE", "Gate Entry", ge.id, "GateEntry", {
      geNumber: ge.gateEntryNumber,
      poId: input.poId,
      vehicleNumber: input.vehicleNumber,
    });
    return ge;
  },

  async createGRN(input, actor) {
    const grn = await dbInventoryService.createGRN(input, actor);
    audit(actor, "CREATE", "GRN", grn.id, "GRN", { grnNumber: grn.grnNumber, gateEntryId: input.gateEntryId });
    return grn;
  },

  async approveGRN(input, actor) {
    const grn = await dbInventoryService.approveGRN(input);
    audit(actor, "APPROVE", "GRN", input.grnId, "GRN", { grnNumber: grn.grnNumber, itemCount: input.items.length });
    return grn;
  },

  async rejectGRN(input, actor) {
    const grn = await dbInventoryService.rejectGRN(input);
    audit(actor, "REJECT", "GRN", input.grnId, "GRN", { grnNumber: grn.grnNumber });
    return grn;
  },

  async postStockLedgerEntries(entries, actor) {
    await dbInventoryService.postStockLedgerEntries(entries);
    if (actor && entries.length > 0) {
      logAudit({
        userId: actor.id,
        userName: actor.name,
        action: "CREATE",
        module: "Stock Ledger",
        entityType: "StockLedger",
        factory: actor.factory,
        details: { entryCount: entries.length, referenceType: entries[0].referenceType },
      });
    }
  },
};
