import type {
  FactoryCode,
  PurchaseOrder,
  PurchaseRequisition,
  PurchaseRequisitionStatusEvent,
  RFQ,
  SupplierQuote,
} from "@/lib/types";
import { dbPrService } from "@/lib/dbServices/prService";
import { logAudit } from "@/lib/auditLogger";

type SupplierCell = {
  supplierId: string;
  unitPrice: number | null;
  taxPercent: number | null;
  landedUnit: number | null;
  deliveryDays: number | null;
  lineTotal: number | null;
};

export type ComparisonLine = {
  prItemId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: "NOS" | "KG" | "MTR";
  quantity: number;
  remarks: string;
  perSupplier: SupplierCell[];
  lowestSupplierId: string | null;
};

export type ComparisonData = {
  rfq: RFQ;
  suppliers: Array<{ id: string; supplierCode: string; supplierName: string }>;
  lines: ComparisonLine[];
  totalsBySupplier: Array<{ supplierId: string; total: number }>;
  bestOverallSupplierId: string | null;
};

type Actor = { id: string; name: string; factory?: FactoryCode };

export type PrService = {
  getPRs: (params?: { delayMs?: number; factory?: FactoryCode }) => Promise<PurchaseRequisition[]>;
  getPRById: (prId: string) => Promise<PurchaseRequisition | null>;
  getPRItems: (prId: string) => Promise<Array<{ id: string; prId: string; itemId: string; quantity: number; remarks: string }>>;
  getPRHistory: (prId: string) => Promise<PurchaseRequisitionStatusEvent[]>;
  createPR: (input: {
    requestedBy: string;
    department: string;
    items: Array<{ itemId: string; quantity: number; remarks: string }>;
    factory?: FactoryCode;
  }, actor?: Actor) => Promise<PurchaseRequisition>;
  updatePR: (input: {
    prId: string;
    department: string;
    items: Array<{ itemId: string; quantity: number; remarks: string }>;
  }, actor?: Actor) => Promise<PurchaseRequisition>;
  submitPR: (input: { prId: string; by: string }, actor?: Actor) => Promise<PurchaseRequisition>;
  approvePR: (input: { prId: string; by: string; note?: string }, actor?: Actor) => Promise<PurchaseRequisition>;
  rejectPR: (input: { prId: string; by: string; note?: string }, actor?: Actor) => Promise<PurchaseRequisition>;

  getRFQs: (params?: { delayMs?: number; factory?: FactoryCode }) => Promise<RFQ[]>;
  getRFQById: (rfqId: string) => Promise<RFQ | null>;
  createRFQ: (input: { linkedPrId: string; selectedSuppliers: string[] }, actor?: Actor) => Promise<RFQ>;
  submitRFQ: (input: { rfqId: string }, actor?: Actor) => Promise<RFQ>;
  addSupplierQuote: (input: {
    rfqId: string;
    supplierId: string;
    itemQuotes: Array<{ itemId: string; unitPrice: number; taxPercent: number; deliveryDays: number }>;
  }, actor?: Actor) => Promise<SupplierQuote>;
  getSupplierQuotes: (rfqId: string) => Promise<SupplierQuote[]>;
  getComparisonData: (rfqId: string) => Promise<ComparisonData>;
  generatePO: (input: { rfqId: string; supplierId: string }, actor?: Actor) => Promise<PurchaseOrder>;
  getPOs: (params?: { delayMs?: number; factory?: FactoryCode }) => Promise<PurchaseOrder[]>;
  getPOById: (poId: string) => Promise<PurchaseOrder | null>;
  approvePO: (input: { poId: string }, actor?: Actor) => Promise<PurchaseOrder>;
  rejectPO: (input: { poId: string }, actor?: Actor) => Promise<PurchaseOrder>;
};

function auditLog(actor: Actor | undefined, action: string, module: string, entityId: string, entityType: string, details?: Record<string, unknown>) {
  if (!actor) return;
  logAudit({
    userId: actor.id,
    userName: actor.name,
    action: action as "CREATE",
    module: module as "Purchase Requisition",
    entityId,
    entityType,
    factory: actor.factory,
    details,
  });
}

export const prService: PrService = {
  getPRs:       (params?)  => dbPrService.getPRs(params),
  getPRById:    (prId)     => dbPrService.getPRById(prId),
  getPRItems:   (prId)     => dbPrService.getPRItems(prId),
  getPRHistory: (prId)     => dbPrService.getPRHistory(prId),

  async createPR(input, actor) {
    const pr = await dbPrService.createPR(input);
    auditLog(actor, "CREATE", "Purchase Requisition", pr.id, "PR", { prNumber: pr.prNumber, itemCount: input.items.length });
    return pr;
  },
  async updatePR(input, actor) {
    const pr = await dbPrService.updatePR(input);
    auditLog(actor, "UPDATE", "Purchase Requisition", input.prId, "PR", { itemCount: input.items.length });
    return pr;
  },
  async submitPR(input, actor) {
    const pr = await dbPrService.submitPR(input);
    auditLog(actor, "SUBMIT", "Purchase Requisition", input.prId, "PR", { prNumber: pr.prNumber });
    return pr;
  },
  async approvePR(input, actor) {
    const pr = await dbPrService.approvePR(input);
    auditLog(actor, "APPROVE", "Purchase Requisition", input.prId, "PR", { prNumber: pr.prNumber, note: input.note });
    return pr;
  },
  async rejectPR(input, actor) {
    const pr = await dbPrService.rejectPR(input);
    auditLog(actor, "REJECT", "Purchase Requisition", input.prId, "PR", { prNumber: pr.prNumber, note: input.note });
    return pr;
  },

  getRFQs:           (params?) => dbPrService.getRFQs(params),
  getRFQById:        (rfqId)   => dbPrService.getRFQById(rfqId),
  getSupplierQuotes: (rfqId)   => dbPrService.getSupplierQuotes(rfqId),
  getComparisonData: (rfqId)   => dbPrService.getComparisonData(rfqId),
  getPOs:            (params?) => dbPrService.getPOs(params),
  getPOById:         (poId)    => dbPrService.getPOById(poId),

  async createRFQ(input, actor) {
    const rfq = await dbPrService.createRFQ(input, actor);
    auditLog(actor, "CREATE", "RFQ", rfq.id, "RFQ", { rfqNumber: rfq.rfqNumber, supplierCount: input.selectedSuppliers.length });
    return rfq;
  },
  async submitRFQ(input, actor) {
    const rfq = await dbPrService.submitRFQ(input, actor);
    auditLog(actor, "SUBMIT", "RFQ", input.rfqId, "RFQ", { rfqNumber: rfq.rfqNumber });
    return rfq;
  },
  async addSupplierQuote(input, actor) {
    const quote = await dbPrService.addSupplierQuote(input, actor);
    auditLog(actor, "CREATE", "RFQ", input.rfqId, "SupplierQuote", { supplierId: input.supplierId });
    return quote;
  },
  async generatePO(input, actor) {
    const po = await dbPrService.generatePO(input, actor);
    auditLog(actor, "CREATE", "Purchase Order", po.id, "PO", { poNumber: po.poNumber, rfqId: input.rfqId, supplierId: input.supplierId });
    return po;
  },
  async approvePO(input, actor) {
    const po = await dbPrService.approvePO(input, actor);
    auditLog(actor, "APPROVE", "Purchase Order", input.poId, "PO", { poNumber: po.poNumber });
    return po;
  },
  async rejectPO(input, actor) {
    const po = await dbPrService.rejectPO(input, actor);
    auditLog(actor, "REJECT", "Purchase Order", input.poId, "PO", { poNumber: po.poNumber });
    return po;
  },
};
