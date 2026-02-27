import type { FactoryCode, GateEntry, GRN, GRNItem, StockLedger } from "@/lib/types";
import { getComparisonData, getPOById, getPOs } from "@/lib/mockData/rfq";
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function computePoLines(poId: string) {
  const po = await getPOById(poId);
  if (!po) throw new Error("PO not found.");
  const cmp = await getComparisonData(po.linkedRfqId);

  const supplierId = po.supplierId;
  const lines = cmp.lines.map((l) => ({
    itemId: l.itemId,
    orderedQty: l.quantity,
    supplierId,
    rfqId: po.linkedRfqId,
  }));
  return { po, lines };
}

let gateEntriesStore: GateEntry[] = [
  {
    id: "ge_0001",
    gateEntryNumber: "GE-YNM-0001",
    poId: "po_0001",
    supplierId: "s_ambit",
    vehicleNumber: "MH12AB1234",
    invoiceNumber: "INV-AMB-102",
    ewayBillNumber: "EWB-001-AMB",
    status: "OPEN",
    factory: "YNM-PUNE",
    createdAt: "2026-02-18T09:30:00.000Z",
  },
];

let grnsStore: GRN[] = [
  {
    id: "grn_0001",
    grnNumber: "GRN-YNM-0001",
    gateEntryId: "ge_0001",
    poId: "po_0001",
    status: "APPROVED",
    factory: "YNM-PUNE",
    createdAt: "2026-02-18T11:00:00.000Z",
  },
];

let grnItemsStore: GRNItem[] = [
  {
    id: "grni_0001",
    grnId: "grn_0001",
    itemId: "i_rm_abs_granules",
    orderedQty: 400,
    receivedQty: 400,
    acceptedQty: 392,
    rejectedQty: 8,
  },
];

let ledgerStore: StockLedger[] = [
  {
    id: "sl_0001",
    itemId: "i_rm_abs_granules",
    transactionType: "INWARD",
    quantity: 392,
    referenceType: "GRN",
    referenceId: "grn_0001",
    factory: "YNM-PUNE",
    createdAt: "2026-02-18T11:10:00.000Z",
  },
];

export async function postStockLedgerEntries(
  entries: Array<{
    itemId: string;
    transactionType: "INWARD" | "OUTWARD";
    quantity: number;
    referenceType: "GRN" | "PRODUCTION" | "DISPATCH";
    referenceId: string;
    createdAt?: string;
    factory?: FactoryCode;
  }>,
): Promise<void> {
  await sleep(80);
  const next: StockLedger[] = entries
    .filter((e) => Number.isFinite(e.quantity) && e.quantity > 0)
    .map((e) => ({
      id: genId("sl"),
      itemId: e.itemId,
      transactionType: e.transactionType,
      quantity: Number(e.quantity),
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      factory: e.factory,
      createdAt: e.createdAt ?? nowIso(),
    }));
  ledgerStore = [...next, ...ledgerStore];
}

export async function getGateEntries(params?: { delayMs?: number; factory?: FactoryCode }): Promise<GateEntry[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  const list = params?.factory
    ? gateEntriesStore.filter((g) => (g.factory ?? "YNM-PUNE") === params.factory)
    : gateEntriesStore;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createGateEntry(input: {
  poId: string;
  vehicleNumber: string;
  invoiceNumber: string;
  ewayBillNumber: string;
  factory?: FactoryCode;
}): Promise<GateEntry> {
  await sleep(450);
  const po = await getPOById(input.poId);
  if (!po) throw new Error("PO not found.");
  // Logic correction: gate entry should only be possible for approved POs.
  const approval = po.approvalStatus ?? "APPROVED";
  if (approval !== "APPROVED") throw new Error("PO must be approved before gate entry.");

  if (!input.vehicleNumber.trim()) throw new Error("Vehicle number is required.");
  if (!input.invoiceNumber.trim()) throw new Error("Invoice number is required.");

  const gateEntryNumber = nextNumber("GE-YNM-", gateEntriesStore.map((g) => g.gateEntryNumber));
  const ge: GateEntry = {
    id: genId("ge"),
    gateEntryNumber,
    poId: input.poId,
    supplierId: po.supplierId,
    vehicleNumber: input.vehicleNumber.trim().toUpperCase(),
    invoiceNumber: input.invoiceNumber.trim(),
    ewayBillNumber: input.ewayBillNumber.trim(),
    status: "OPEN",
    factory: input.factory ?? po.factory ?? "YNM-PUNE",
    createdAt: nowIso(),
  };
  gateEntriesStore = [ge, ...gateEntriesStore];
  await logAudit({
    user: "Security",
    action: "CREATE_GATE_ENTRY",
    module: "Inventory",
    factory: ge.factory,
    timestamp: ge.createdAt,
  });
  return ge;
}

export async function closeGateEntry(gateEntryId: string): Promise<GateEntry> {
  await sleep(200);
  const ge = gateEntriesStore.find((g) => g.id === gateEntryId);
  if (!ge) throw new Error("Gate entry not found.");
  const next = { ...ge, status: "CLOSED" as const };
  gateEntriesStore = gateEntriesStore.map((g) => (g.id === gateEntryId ? next : g));
  return next;
}

export async function getGRNs(params?: { delayMs?: number; factory?: FactoryCode }): Promise<GRN[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  const list = params?.factory
    ? grnsStore.filter((g) => (g.factory ?? "YNM-PUNE") === params.factory)
    : grnsStore;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getGRNById(grnId: string): Promise<GRN | null> {
  await sleep(120);
  return grnsStore.find((g) => g.id === grnId) ?? null;
}

export async function getGRNItems(grnId: string): Promise<GRNItem[]> {
  await sleep(120);
  return grnItemsStore.filter((i) => i.grnId === grnId);
}

export async function createGRN(input: { gateEntryId: string }): Promise<GRN> {
  await sleep(500);
  const ge = gateEntriesStore.find((g) => g.id === input.gateEntryId);
  if (!ge) throw new Error("Gate entry not found.");
  if (ge.status !== "OPEN") throw new Error("Only open gate entries can be used for GRN creation.");

  const existing = grnsStore.find((g) => g.gateEntryId === ge.id);
  if (existing) throw new Error("A GRN already exists for this gate entry.");

  const { po, lines } = await computePoLines(ge.poId);

  const grnNumber = nextNumber("GRN-YNM-", grnsStore.map((g) => g.grnNumber));
  const grn: GRN = {
    id: genId("grn"),
    grnNumber,
    gateEntryId: ge.id,
    poId: po.id,
    status: "DRAFT",
    factory: ge.factory ?? "YNM-PUNE",
    createdAt: nowIso(),
  };

  const items: GRNItem[] = lines.map((l) => ({
    id: genId("grni"),
    grnId: grn.id,
    itemId: l.itemId,
    orderedQty: l.orderedQty,
    receivedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
  }));

  grnsStore = [grn, ...grnsStore];
  grnItemsStore = [...items, ...grnItemsStore];
  await logAudit({
    user: "Stores",
    action: "CREATE_GRN",
    module: "Inventory",
    factory: grn.factory,
    timestamp: grn.createdAt,
  });
  return grn;
}

export async function approveGRN(input: {
  grnId: string;
  items: Array<{ itemId: string; receivedQty: number; acceptedQty: number }>;
}): Promise<GRN> {
  await sleep(500);
  const grn = grnsStore.find((g) => g.id === input.grnId);
  if (!grn) throw new Error("GRN not found.");
  if (grn.status !== "DRAFT") throw new Error("Only draft GRNs can be approved.");

  const existingItems = grnItemsStore.filter((i) => i.grnId === grn.id);
  if (existingItems.length === 0) throw new Error("GRN has no items.");

  const map = new Map(input.items.map((i) => [i.itemId, i]));

  const nextItems: GRNItem[] = existingItems.map((line) => {
    const upd = map.get(line.itemId);
    // Logic correction: prevent receiving/accepting more than ordered.
    const receivedQty = clamp(Number(upd?.receivedQty ?? 0), 0, line.orderedQty);
    const acceptedQty = clamp(Number(upd?.acceptedQty ?? 0), 0, receivedQty);
    const rejectedQty = clamp(receivedQty - acceptedQty, 0, line.orderedQty);
    return {
      ...line,
      receivedQty,
      acceptedQty,
      rejectedQty,
    };
  });

  // Validate at least one received line
  const totalAccepted = nextItems.reduce((sum, i) => sum + i.acceptedQty, 0);
  if (totalAccepted <= 0) throw new Error("At least one line must have accepted quantity > 0.");

  // Persist GRN lines
  grnItemsStore = grnItemsStore.map((i) => {
    if (i.grnId !== grn.id) return i;
    const next = nextItems.find((x) => x.id === i.id);
    return next ?? i;
  });

  // Create stock ledger INWARD entries for accepted qty
  const newLedger: StockLedger[] = nextItems
    .filter((i) => i.acceptedQty > 0)
    .map((i) => ({
      id: genId("sl"),
      itemId: i.itemId,
      transactionType: "INWARD",
      quantity: i.acceptedQty,
      referenceType: "GRN",
      referenceId: grn.id,
      factory: grn.factory,
      createdAt: nowIso(),
    }));
  ledgerStore = [...newLedger, ...ledgerStore];

  // Approve GRN and close gate entry
  const nextGrn: GRN = { ...grn, status: "APPROVED" };
  grnsStore = grnsStore.map((g) => (g.id === grn.id ? nextGrn : g));
  await closeGateEntry(grn.gateEntryId);

  await logAudit({
    user: "Stores",
    action: "APPROVE_GRN",
    module: "Inventory",
    factory: nextGrn.factory,
  });
  return nextGrn;
}

export async function getStockLedger(params?: {
  delayMs?: number;
  itemId?: string;
  transactionType?: "INWARD" | "OUTWARD";
  factory?: FactoryCode;
}): Promise<StockLedger[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  let list = [...ledgerStore];
  if (params?.factory) list = list.filter((l) => (l.factory ?? "YNM-PUNE") === params.factory);
  if (params?.itemId) list = list.filter((l) => l.itemId === params.itemId);
  if (params?.transactionType) list = list.filter((l) => l.transactionType === params.transactionType);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCurrentStock(params?: { factory?: FactoryCode }): Promise<Record<string, number>> {
  await sleep(120);
  const stock: Record<string, number> = {};
  const list = params?.factory
    ? ledgerStore.filter((l) => (l.factory ?? "YNM-PUNE") === params.factory)
    : ledgerStore;
  for (const l of list) {
    const sign = l.transactionType === "INWARD" ? 1 : -1;
    stock[l.itemId] = (stock[l.itemId] ?? 0) + sign * l.quantity;
  }
  return stock;
}

export async function getOpenPOs(params?: { factory?: FactoryCode }): Promise<Array<{ id: string; poNumber: string; supplierId: string; status: string }>> {
  const pos = await getPOs({ factory: params?.factory });
  return pos
    // Logic correction: expose only approved POs for downstream inward workflows.
    .filter((p) => (p.approvalStatus ?? "APPROVED") === "APPROVED")
    .filter((p) => p.status === "OPEN" || p.status === "PARTIAL")
    .map((p) => ({ id: p.id, poNumber: p.poNumber, supplierId: p.supplierId, status: p.status }));
}

export async function rejectGRN(input: { grnId: string }): Promise<GRN> {
  await sleep(350);
  const grn = grnsStore.find((g) => g.id === input.grnId);
  if (!grn) throw new Error("GRN not found.");
  if (grn.status !== "DRAFT") throw new Error("Only draft GRNs can be rejected.");
  const next: GRN = { ...grn, status: "REJECTED" };
  grnsStore = grnsStore.map((g) => (g.id === grn.id ? next : g));
  await closeGateEntry(grn.gateEntryId);
  await logAudit({
    user: "Stores",
    action: "REJECT_GRN",
    module: "Inventory",
    factory: next.factory,
  });
  return next;
}

