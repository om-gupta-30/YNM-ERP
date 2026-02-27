import type { FactoryCode, PurchaseOrder, RFQ, RFQStatus, SupplierQuote } from "@/lib/types";
import { getItems } from "@/lib/mockData/items";
import { getPRItems, getPRs } from "@/lib/mockData/purchaseRequisitions";
import { getSuppliers } from "@/lib/mockData/suppliers";
import { logAudit } from "@/lib/mockData/audit";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  // Logic correction: reduce collision risk vs Math.random-only IDs.
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}_${uuid}`
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nextNumber(prefix: string, existing: string[]) {
  const nums = existing
    .map((s) => {
      const m = s.match(/(\d+)$/);
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function landed(unitPrice: number, taxPercent: number) {
  return unitPrice * (1 + taxPercent / 100);
}

let rfqsStore: RFQ[] = [
  {
    id: "rfq_0001",
    rfqNumber: "RFQ-YNM-0001",
    linkedPrId: "pr_0010",
    selectedSuppliers: ["s_ambit", "s_polychem"],
    status: "QUOTED",
    factory: "YNM-PUNE",
    createdAt: "2026-02-16T09:00:00.000Z",
  },
];

let supplierQuotesStore: SupplierQuote[] = [
  {
    id: "sq_0001",
    rfqId: "rfq_0001",
    supplierId: "s_ambit",
    itemQuotes: [
      { itemId: "i_rm_abs_granules", unitPrice: 210, taxPercent: 18, deliveryDays: 7 },
    ],
  },
  {
    id: "sq_0002",
    rfqId: "rfq_0001",
    supplierId: "s_polychem",
    itemQuotes: [
      { itemId: "i_rm_abs_granules", unitPrice: 205, taxPercent: 18, deliveryDays: 10 },
    ],
  },
];

let posStore: PurchaseOrder[] = [
  {
    id: "po_0001",
    poNumber: "PO-YNM-0001",
    supplierId: "s_ambit",
    linkedRfqId: "rfq_0001",
    status: "OPEN",
    approvalStatus: "APPROVED",
    factory: "YNM-PUNE",
    createdAt: "2026-02-17T12:15:00.000Z",
  },
];

export async function getRFQs(params?: { delayMs?: number; factory?: FactoryCode }): Promise<RFQ[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  const list = params?.factory
    ? rfqsStore.filter((r) => (r.factory ?? "YNM-PUNE") === params.factory)
    : rfqsStore;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRFQById(rfqId: string): Promise<RFQ | null> {
  await sleep(120);
  return rfqsStore.find((r) => r.id === rfqId) ?? null;
}

export async function getSupplierQuotes(rfqId: string): Promise<SupplierQuote[]> {
  await sleep(120);
  return supplierQuotesStore.filter((q) => q.rfqId === rfqId);
}

export async function createRFQ(input: {
  linkedPrId: string;
  selectedSuppliers: string[];
}): Promise<RFQ> {
  await sleep(450);
  const pr = (await getPRs()).find((p) => p.id === input.linkedPrId);
  if (!pr) throw new Error("Linked PR not found.");
  if (pr.status !== "APPROVED") throw new Error("Only approved PRs can be linked to an RFQ.");

  const supplierIds = input.selectedSuppliers.filter(Boolean);
  if (supplierIds.length < 1) throw new Error("Select at least one supplier.");
  if (new Set(supplierIds).size !== supplierIds.length) throw new Error("Duplicate suppliers are not allowed.");

  const rfqNumber = nextNumber("RFQ-YNM-", rfqsStore.map((r) => r.rfqNumber));
  const rfq: RFQ = {
    id: genId("rfq"),
    rfqNumber,
    linkedPrId: input.linkedPrId,
    selectedSuppliers: supplierIds,
    status: "DRAFT",
    factory: pr.factory ?? "YNM-PUNE",
    createdAt: nowIso(),
  };
  rfqsStore = [rfq, ...rfqsStore];
  await logAudit({
    user: "Purchase",
    action: "CREATE_RFQ",
    module: "RFQ",
    factory: rfq.factory,
    timestamp: rfq.createdAt,
  });
  return rfq;
}

export async function submitRFQ(input: { rfqId: string }): Promise<RFQ> {
  await sleep(300);
  const rfq = rfqsStore.find((r) => r.id === input.rfqId);
  if (!rfq) throw new Error("RFQ not found.");
  if (rfq.status !== "DRAFT") throw new Error("Only draft RFQs can be submitted/sent.");
  rfqsStore = rfqsStore.map((r) => (r.id === rfq.id ? { ...r, status: "SENT" } : r));
  await logAudit({
    user: "Purchase",
    action: "SUBMIT_RFQ",
    module: "RFQ",
    factory: rfq.factory,
  });
  return rfqsStore.find((r) => r.id === rfq.id)!;
}

function validateQuoteItems(items: Array<{ itemId: string; unitPrice: number; taxPercent: number; deliveryDays: number }>) {
  if (!items.length) throw new Error("At least one item quote is required.");
  const ids = items.map((i) => i.itemId).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate items in quote are not allowed.");
  for (const q of items) {
    if (!q.itemId) throw new Error("Item is required.");
    if (!Number.isFinite(q.unitPrice) || q.unitPrice <= 0) throw new Error("Unit price must be > 0.");
    if (!Number.isFinite(q.taxPercent) || q.taxPercent < 0 || q.taxPercent > 100) throw new Error("Tax % must be between 0 and 100.");
    if (!Number.isFinite(q.deliveryDays) || q.deliveryDays < 0) throw new Error("Delivery days must be >= 0.");
  }
}

export async function addSupplierQuote(input: {
  rfqId: string;
  supplierId: string;
  itemQuotes: Array<{ itemId: string; unitPrice: number; taxPercent: number; deliveryDays: number }>;
}): Promise<SupplierQuote> {
  await sleep(450);
  const rfq = rfqsStore.find((r) => r.id === input.rfqId);
  if (!rfq) throw new Error("RFQ not found.");
  if (rfq.status === "CLOSED") throw new Error("Cannot add quotes to a closed RFQ.");
  if (!rfq.selectedSuppliers.includes(input.supplierId)) throw new Error("Supplier is not selected for this RFQ.");

  validateQuoteItems(input.itemQuotes);

  const quote: SupplierQuote = {
    id: genId("sq"),
    rfqId: rfq.id,
    supplierId: input.supplierId,
    itemQuotes: input.itemQuotes.map((q) => ({
      itemId: q.itemId,
      unitPrice: Number(q.unitPrice),
      taxPercent: Number(q.taxPercent),
      deliveryDays: Number(q.deliveryDays),
    })),
  };

  supplierQuotesStore = supplierQuotesStore.filter(
    (q) => !(q.rfqId === rfq.id && q.supplierId === input.supplierId),
  );
  supplierQuotesStore = [quote, ...supplierQuotesStore];

  if (rfq.status === "DRAFT" || rfq.status === "SENT") {
    rfqsStore = rfqsStore.map((r) => (r.id === rfq.id ? { ...r, status: "QUOTED" } : r));
  }

  await logAudit({
    user: "Purchase",
    action: "ADD_SUPPLIER_QUOTE",
    module: "RFQ",
    factory: rfq.factory,
  });
  return quote;
}

export async function getComparisonData(rfqId: string) {
  await sleep(200);
  const rfq = await getRFQById(rfqId);
  if (!rfq) throw new Error("RFQ not found.");

  const [items, suppliers, prItems, quotes] = await Promise.all([
    getItems(),
    getSuppliers(),
    getPRItems(rfq.linkedPrId),
    getSupplierQuotes(rfq.id),
  ]);

  const itemById = new Map(items.map((i) => [i.id, i]));
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const quoteBySupplier = new Map(quotes.map((q) => [q.supplierId, q]));

  const selectedSuppliers = rfq.selectedSuppliers
    .map((id) => supplierById.get(id))
    .filter(Boolean);

  const lines = prItems.map((pi) => {
    const it = itemById.get(pi.itemId);
    const perSupplier = rfq.selectedSuppliers.map((supplierId) => {
      const sq = quoteBySupplier.get(supplierId);
      const iq = sq?.itemQuotes.find((x) => x.itemId === pi.itemId);
      const unitPrice = iq?.unitPrice ?? null;
      const taxPercent = iq?.taxPercent ?? null;
      const deliveryDays = iq?.deliveryDays ?? null;
      const landedUnit = unitPrice != null && taxPercent != null ? landed(unitPrice, taxPercent) : null;
      return {
        supplierId,
        unitPrice,
        taxPercent,
        landedUnit,
        deliveryDays,
        lineTotal:
          landedUnit != null ? Number((landedUnit * pi.quantity).toFixed(2)) : null,
      };
    });

    const min = perSupplier
      .filter((p) => p.landedUnit != null)
      .sort((a, b) => (a.landedUnit! - b.landedUnit!))[0];

    return {
      prItemId: pi.id,
      itemId: pi.itemId,
      itemCode: it?.itemCode ?? "—",
      itemName: it?.itemName ?? "—",
      uom: it?.uom ?? "NOS",
      quantity: pi.quantity,
      remarks: pi.remarks,
      perSupplier,
      lowestSupplierId: min?.supplierId ?? null,
    };
  });

  const totalsBySupplier = rfq.selectedSuppliers.map((supplierId) => {
    const total = lines.reduce((sum, l) => {
      const cell = l.perSupplier.find((p) => p.supplierId === supplierId);
      return sum + (cell?.lineTotal ?? 0);
    }, 0);
    return { supplierId, total: Number(total.toFixed(2)) };
  });

  const bestOverall = [...totalsBySupplier].sort((a, b) => a.total - b.total)[0];

  return {
    rfq,
    suppliers: selectedSuppliers.map((s) => ({
      id: s!.id,
      supplierCode: s!.supplierCode,
      supplierName: s!.supplierName,
    })),
    lines,
    totalsBySupplier,
    bestOverallSupplierId: bestOverall?.supplierId ?? null,
  };
}

export async function generatePO(input: { rfqId: string; supplierId: string }): Promise<PurchaseOrder> {
  await sleep(450);
  const rfq = rfqsStore.find((r) => r.id === input.rfqId);
  if (!rfq) throw new Error("RFQ not found.");
  if (rfq.status === "CLOSED") throw new Error("RFQ already closed.");
  if (!rfq.selectedSuppliers.includes(input.supplierId)) throw new Error("Supplier not selected for this RFQ.");

  const quotes = await getSupplierQuotes(rfq.id);
  const sq = quotes.find((q) => q.supplierId === input.supplierId);
  if (!sq) throw new Error("No quote found for selected supplier.");

  const prItems = await getPRItems(rfq.linkedPrId);
  for (const pi of prItems) {
    const iq = sq.itemQuotes.find((x) => x.itemId === pi.itemId);
    if (!iq) throw new Error("Selected supplier quote is incomplete for all PR items.");
  }

  const poNumber = nextNumber("PO-YNM-", posStore.map((p) => p.poNumber));
  const po: PurchaseOrder = {
    id: genId("po"),
    poNumber,
    supplierId: input.supplierId,
    linkedRfqId: rfq.id,
    status: "OPEN",
    approvalStatus: "PENDING",
    factory: rfq.factory ?? "YNM-PUNE",
    createdAt: nowIso(),
  };
  posStore = [po, ...posStore];

  rfqsStore = rfqsStore.map((r) => (r.id === rfq.id ? { ...r, status: "CLOSED" } : r));
  await logAudit({
    user: "Purchase",
    action: "GENERATE_PO",
    module: "Purchase Order",
    factory: po.factory,
    timestamp: po.createdAt,
  });
  return po;
}

export async function getPOs(params?: { delayMs?: number; factory?: FactoryCode }): Promise<PurchaseOrder[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  const list = params?.factory
    ? posStore.filter((p) => (p.factory ?? "YNM-PUNE") === params.factory)
    : posStore;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPOById(poId: string): Promise<PurchaseOrder | null> {
  await sleep(120);
  return posStore.find((p) => p.id === poId) ?? null;
}

export async function approvePO(input: { poId: string }): Promise<PurchaseOrder> {
  await sleep(250);
  const po = posStore.find((p) => p.id === input.poId);
  if (!po) throw new Error("PO not found.");
  if (po.approvalStatus === "APPROVED") return po;
  if (po.approvalStatus === "REJECTED") throw new Error("Rejected POs cannot be approved.");
  const next = { ...po, approvalStatus: "APPROVED" as const };
  posStore = posStore.map((p) => (p.id === po.id ? next : p));
  await logAudit({
    user: "Admin",
    action: "APPROVE_PO",
    module: "Purchase Order",
    factory: next.factory,
  });
  return next;
}

export async function rejectPO(input: { poId: string }): Promise<PurchaseOrder> {
  await sleep(250);
  const po = posStore.find((p) => p.id === input.poId);
  if (!po) throw new Error("PO not found.");
  if (po.approvalStatus === "REJECTED") return po;
  if (po.approvalStatus === "APPROVED") throw new Error("Approved POs cannot be rejected.");
  const next = { ...po, approvalStatus: "REJECTED" as const };
  posStore = posStore.map((p) => (p.id === po.id ? next : p));
  await logAudit({
    user: "Admin",
    action: "REJECT_PO",
    module: "Purchase Order",
    factory: next.factory,
  });
  return next;
}

export async function setRFQStatus(rfqId: string, status: RFQStatus): Promise<RFQ> {
  await sleep(150);
  const rfq = rfqsStore.find((r) => r.id === rfqId);
  if (!rfq) throw new Error("RFQ not found.");
  rfqsStore = rfqsStore.map((r) => (r.id === rfqId ? { ...r, status } : r));
  return rfqsStore.find((r) => r.id === rfqId)!;
}

