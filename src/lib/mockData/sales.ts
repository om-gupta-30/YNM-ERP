import type {
  Dispatch,
  DispatchItem,
  FactoryCode,
  Invoice,
  SalesOrder,
  SalesOrderItem,
} from "@/lib/types";
import { getCurrentStock, postStockLedgerEntries } from "@/lib/mockData/inventory";
import { logAudit } from "@/lib/mockData/audit";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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

let salesOrdersStore: SalesOrder[] = [
  {
    id: "so_0001",
    soNumber: "SO-YNM-0001",
    customerId: "c_ynm_keyacct_1",
    orderDate: "2026-02-18",
    status: "IN_PROGRESS",
    factory: "YNM-PUNE",
    createdAt: "2026-02-18T09:00:00.000Z",
  },
];

let salesOrderItemsStore: SalesOrderItem[] = [
  {
    id: "soi_0001",
    soId: "so_0001",
    itemId: "i_fg_gloves",
    quantity: 200,
    rate: 450,
  },
];

let dispatchesStore: Dispatch[] = [
  {
    id: "dsp_0001",
    dispatchNumber: "DSP-YNM-0001",
    soId: "so_0001",
    dispatchDate: "2026-02-18",
    status: "DISPATCHED",
    factory: "YNM-PUNE",
    createdAt: "2026-02-18T12:00:00.000Z",
  },
];

let dispatchItemsStore: DispatchItem[] = [
  {
    id: "dspi_0001",
    dispatchId: "dsp_0001",
    itemId: "i_fg_gloves",
    quantityDispatched: 50,
  },
];

let invoicesStore: Invoice[] = [
  {
    id: "inv_0001",
    invoiceNumber: "INV-YNM-0001",
    dispatchId: "dsp_0001",
    totalAmount: 22500,
    taxAmount: 4050,
    factory: "YNM-PUNE",
    createdAt: "2026-02-18T12:10:00.000Z",
  },
];

export async function getSalesOrders(params?: { delayMs?: number; factory?: FactoryCode }): Promise<SalesOrder[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  const list = params?.factory
    ? salesOrdersStore.filter((s) => (s.factory ?? "YNM-PUNE") === params.factory)
    : salesOrdersStore;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSalesOrderById(soId: string): Promise<SalesOrder | null> {
  await sleep(120);
  return salesOrdersStore.find((s) => s.id === soId) ?? null;
}

export async function getSalesOrderItems(soId: string): Promise<SalesOrderItem[]> {
  await sleep(120);
  return salesOrderItemsStore.filter((i) => i.soId === soId);
}

export async function createSalesOrder(input: {
  customerId: string;
  orderDate?: string;
  items: Array<{ itemId: string; quantity: number; rate: number }>;
  factory?: FactoryCode;
}): Promise<SalesOrder> {
  await sleep(450);
  if (!input.customerId) throw new Error("Customer is required.");
  if (!input.items.length) throw new Error("At least one item is required.");

  const ids = input.items.map((i) => i.itemId).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate items are not allowed.");

  for (const it of input.items) {
    if (!it.itemId) throw new Error("Item is required.");
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) throw new Error("Quantity must be > 0.");
    if (!Number.isFinite(it.rate) || it.rate < 0) throw new Error("Rate must be >= 0.");
  }

  const soNumber = nextNumber("SO-YNM-", salesOrdersStore.map((s) => s.soNumber));
  const so: SalesOrder = {
    id: genId("so"),
    soNumber,
    customerId: input.customerId,
    orderDate: input.orderDate ?? todayIsoDate(),
    status: "OPEN",
    factory: input.factory ?? "YNM-PUNE",
    createdAt: nowIso(),
  };
  salesOrdersStore = [so, ...salesOrdersStore];

  const soItems: SalesOrderItem[] = input.items.map((it) => ({
    id: genId("soi"),
    soId: so.id,
    itemId: it.itemId,
    quantity: Number(it.quantity),
    rate: Number(it.rate),
  }));
  salesOrderItemsStore = [...soItems, ...salesOrderItemsStore];
  await logAudit({
    user: "Sales",
    action: "CREATE_SALES_ORDER",
    module: "Sales",
    factory: so.factory,
    timestamp: so.createdAt,
  });
  return so;
}

export async function getDispatches(params?: { delayMs?: number; factory?: FactoryCode }): Promise<Dispatch[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  const list = params?.factory
    ? dispatchesStore.filter((d) => (d.factory ?? "YNM-PUNE") === params.factory)
    : dispatchesStore;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDispatchById(dispatchId: string): Promise<Dispatch | null> {
  await sleep(120);
  return dispatchesStore.find((d) => d.id === dispatchId) ?? null;
}

export async function getDispatchItems(dispatchId: string): Promise<DispatchItem[]> {
  await sleep(120);
  return dispatchItemsStore.filter((i) => i.dispatchId === dispatchId);
}

export async function createDispatch(input: {
  soId: string;
  dispatchDate?: string;
  factory?: FactoryCode;
}): Promise<Dispatch> {
  await sleep(400);
  const so = await getSalesOrderById(input.soId);
  if (!so) throw new Error("Sales order not found.");
  // Logic correction: prevent creating a dispatch in a different factory than the SO.
  if (input.factory && so.factory && input.factory !== so.factory) {
    throw new Error("Sales order belongs to a different factory.");
  }

  const existing = dispatchesStore.find((d) => d.soId === so.id && d.status === "PENDING");
  if (existing) throw new Error("A pending dispatch already exists for this sales order.");

  const dispatchNumber = nextNumber("DSP-YNM-", dispatchesStore.map((d) => d.dispatchNumber));
  const dispatch: Dispatch = {
    id: genId("dsp"),
    dispatchNumber,
    soId: so.id,
    dispatchDate: input.dispatchDate ?? todayIsoDate(),
    status: "PENDING",
    factory: input.factory ?? so.factory ?? "YNM-PUNE",
    createdAt: nowIso(),
  };
  dispatchesStore = [dispatch, ...dispatchesStore];

  const soItems = await getSalesOrderItems(so.id);
  const lines: DispatchItem[] = soItems.map((i) => ({
    id: genId("dspi"),
    dispatchId: dispatch.id,
    itemId: i.itemId,
    quantityDispatched: 0,
  }));
  dispatchItemsStore = [...lines, ...dispatchItemsStore];

  if (so.status === "OPEN") {
    salesOrdersStore = salesOrdersStore.map((s) =>
      s.id === so.id ? { ...s, status: "IN_PROGRESS" } : s,
    );
  }

  await logAudit({
    user: "Stores",
    action: "CREATE_DISPATCH",
    module: "Dispatch",
    factory: dispatch.factory,
    timestamp: dispatch.createdAt,
  });
  return dispatch;
}

export async function dispatchGoods(input: {
  dispatchId: string;
  items: Array<{ itemId: string; quantityDispatched: number }>;
}): Promise<Dispatch> {
  await sleep(500);
  const dispatch = await getDispatchById(input.dispatchId);
  if (!dispatch) throw new Error("Dispatch not found.");
  if (dispatch.status !== "PENDING") throw new Error("Only pending dispatches can be dispatched.");

  const so = await getSalesOrderById(dispatch.soId);
  if (!so) throw new Error("Sales order not found.");
  const soItems = await getSalesOrderItems(so.id);
  const soByItem = new Map(soItems.map((i) => [i.itemId, i]));

  const ids = input.items.map((i) => i.itemId).filter(Boolean);
  if (!ids.length) throw new Error("No dispatch quantities provided.");
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate dispatch items are not allowed.");
  // Logic correction: disallow dispatching with all zero quantities.
  const anyQty = input.items.some((i) => Number(i.quantityDispatched) > 0);
  if (!anyQty) throw new Error("At least one item must have dispatched quantity > 0.");

  // Logic correction: prevent over-dispatching across multiple dispatches for the same SO.
  const priorDispatchedByItem: Record<string, number> = {};
  for (const d of dispatchesStore) {
    if (d.soId !== so.id) continue;
    if (d.status !== "DISPATCHED") continue;
    for (const di of dispatchItemsStore) {
      if (di.dispatchId !== d.id) continue;
      priorDispatchedByItem[di.itemId] =
        (priorDispatchedByItem[di.itemId] ?? 0) + di.quantityDispatched;
    }
  }

  const scopedStock = await getCurrentStock({ factory: dispatch.factory ?? "YNM-PUNE" });

  for (const line of input.items) {
    const soLine = soByItem.get(line.itemId);
    if (!soLine) throw new Error("Item is not part of the sales order.");
    if (!Number.isFinite(line.quantityDispatched) || line.quantityDispatched < 0) {
      throw new Error("Dispatch quantity must be >= 0.");
    }
    const prior = priorDispatchedByItem[line.itemId] ?? 0;
    if (prior + Number(line.quantityDispatched) - soLine.quantity > 1e-9) {
      throw new Error("Dispatch quantity exceeds remaining sales order quantity.");
    }
    const available = scopedStock[line.itemId] ?? 0;
    if (line.quantityDispatched - available > 1e-9) {
      throw new Error("Insufficient stock for one or more items.");
    }
  }

  // Update dispatch lines
  dispatchItemsStore = dispatchItemsStore.map((di) => {
    if (di.dispatchId !== dispatch.id) return di;
    const upd = input.items.find((x) => x.itemId === di.itemId);
    if (!upd) return di;
    return { ...di, quantityDispatched: Number(upd.quantityDispatched) };
  });

  await postStockLedgerEntries(
    input.items
      .filter((i) => i.quantityDispatched > 0)
      .map((i) => ({
        itemId: i.itemId,
        transactionType: "OUTWARD" as const,
        quantity: Number(i.quantityDispatched),
        referenceType: "DISPATCH" as const,
        referenceId: dispatch.id,
        createdAt: nowIso(),
        factory: dispatch.factory,
      })),
  );

  const next: Dispatch = { ...dispatch, status: "DISPATCHED" };
  dispatchesStore = dispatchesStore.map((d) => (d.id === dispatch.id ? next : d));

  // Update SO status if fully dispatched (sum of dispatched across all dispatches)
  const allDispatchItems = dispatchItemsStore.filter((di) =>
    dispatchesStore.some((d) => d.soId === so.id && d.id === di.dispatchId && d.status === "DISPATCHED"),
  );
  const dispatchedByItem: Record<string, number> = {};
  for (const di of allDispatchItems) {
    dispatchedByItem[di.itemId] = (dispatchedByItem[di.itemId] ?? 0) + di.quantityDispatched;
  }

  const fullyDone = soItems.every((i) => (dispatchedByItem[i.itemId] ?? 0) + 1e-9 >= i.quantity);
  salesOrdersStore = salesOrdersStore.map((s) =>
    s.id === so.id ? { ...s, status: fullyDone ? "COMPLETED" : "IN_PROGRESS" } : s,
  );

  await logAudit({
    user: "Stores",
    action: "DISPATCH_GOODS",
    module: "Dispatch",
    factory: next.factory,
  });
  return next;
}

export async function getInvoices(params?: { delayMs?: number; factory?: FactoryCode }): Promise<Invoice[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  const list = params?.factory
    ? invoicesStore.filter((i) => (i.factory ?? "YNM-PUNE") === params.factory)
    : invoicesStore;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getInvoiceByDispatchId(dispatchId: string): Promise<Invoice | null> {
  await sleep(120);
  return invoicesStore.find((i) => i.dispatchId === dispatchId) ?? null;
}

export async function generateInvoice(input: { dispatchId: string }): Promise<Invoice> {
  await sleep(450);
  const dispatch = await getDispatchById(input.dispatchId);
  if (!dispatch) throw new Error("Dispatch not found.");
  if (dispatch.status !== "DISPATCHED") throw new Error("Invoice can be generated only for dispatched records.");

  const existing = await getInvoiceByDispatchId(dispatch.id);
  if (existing) return existing;

  const so = await getSalesOrderById(dispatch.soId);
  if (!so) throw new Error("Sales order not found.");
  const soItems = await getSalesOrderItems(so.id);
  const rateByItem = new Map(soItems.map((i) => [i.itemId, i.rate]));

  const lines = await getDispatchItems(dispatch.id);
  const total = lines.reduce((sum, l) => {
    const rate = rateByItem.get(l.itemId) ?? 0;
    return sum + l.quantityDispatched * rate;
  }, 0);

  const gstPercent = 18;
  const tax = (total * gstPercent) / 100;

  const invoiceNumber = nextNumber("INV-YNM-", invoicesStore.map((i) => i.invoiceNumber));
  const inv: Invoice = {
    id: genId("inv"),
    invoiceNumber,
    dispatchId: dispatch.id,
    totalAmount: Number(total.toFixed(2)),
    taxAmount: Number(tax.toFixed(2)),
    factory: dispatch.factory,
    createdAt: nowIso(),
  };
  invoicesStore = [inv, ...invoicesStore];
  await logAudit({
    user: "Accounts",
    action: "GENERATE_INVOICE",
    module: "Invoice",
    factory: inv.factory,
    timestamp: inv.createdAt,
  });
  return inv;
}

