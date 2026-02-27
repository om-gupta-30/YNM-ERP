import type {
  Dispatch,
  DispatchItem,
  FactoryCode,
  Invoice,
  SalesOrder,
  SalesOrderItem,
} from "@/lib/types";
import type { SalesService } from "@/lib/services/salesService";
import { assertNoError, getClient, getFactoryId, getFactoryCode, retryQuery } from "./_helpers";

// ---- Schema mapping notes ----
// sales_orders.so_number        → SalesOrder.soNumber
// sales_orders.status mapping:
//   draft|confirmed → OPEN, in_production|ready|dispatched → IN_PROGRESS,
//   invoiced|closed|cancelled → COMPLETED
// so_items.unit_price           → SalesOrderItem.rate
// dispatches.dispatch_number    → Dispatch.dispatchNumber
// dispatches.status:
//   draft|pending → PENDING, dispatched|delivered → DISPATCHED
// dispatch_items.dispatched_qty → DispatchItem.quantityDispatched
// invoices.total_amount         → Invoice.totalAmount
// invoices.tax_amount           → Invoice.taxAmount
//
// Stock ledger posting:
//   dispatchGoods  → OUTWARD entries (negative quantity) per dispatched item

// ---- Sequence number helpers ----

async function nextSONumber(): Promise<string> {
  const { count } = await getClient()
    .from("sales_orders")
    .select("*", { count: "exact", head: true });
  return `SO-YNM-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

async function nextDispatchNumber(): Promise<string> {
  const { count } = await getClient()
    .from("dispatches")
    .select("*", { count: "exact", head: true });
  return `DISP-YNM-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

async function nextInvoiceNumber(): Promise<string> {
  const { count } = await getClient()
    .from("invoices")
    .select("*", { count: "exact", head: true });
  return `INV-YNM-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

// ---- Row mappers ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSalesOrder(row: Record<string, any>, factoryCode?: FactoryCode): SalesOrder {
  return {
    id: row.id as string,
    soNumber: row.so_number as string,
    customerId: row.customer_id as string,
    orderDate: (row.order_date as string) ?? new Date().toISOString().slice(0, 10),
    status: mapSOStatus(row.status as string),
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

function mapSOStatus(dbStatus: string): SalesOrder["status"] {
  const map: Record<string, SalesOrder["status"]> = {
    draft: "OPEN",
    confirmed: "OPEN",
    in_production: "IN_PROGRESS",
    ready: "IN_PROGRESS",
    dispatched: "IN_PROGRESS",
    invoiced: "COMPLETED",
    closed: "COMPLETED",
    cancelled: "COMPLETED",
  };
  return map[dbStatus] ?? "OPEN";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSalesOrderItem(row: Record<string, any>): SalesOrderItem {
  return {
    id: row.id as string,
    soId: row.so_id as string,
    itemId: row.item_id as string,
    quantity: Number(row.quantity),
    rate: Number(row.unit_price ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDispatch(row: Record<string, any>, factoryCode?: FactoryCode): Dispatch {
  const dbStatus = (row.status as string).toUpperCase();
  return {
    id: row.id as string,
    dispatchNumber: row.dispatch_number as string,
    soId: row.so_id as string,
    dispatchDate: (row.dispatch_date as string) ?? new Date().toISOString().slice(0, 10),
    status: dbStatus === "DISPATCHED" || dbStatus === "DELIVERED" ? "DISPATCHED" : "PENDING",
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDispatchItem(row: Record<string, any>): DispatchItem {
  return {
    id: row.id as string,
    dispatchId: row.dispatch_id as string,
    itemId: row.item_id as string,
    quantityDispatched: Number(row.dispatched_qty),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toInvoice(row: Record<string, any>, factoryCode?: FactoryCode): Invoice {
  return {
    id: row.id as string,
    invoiceNumber: row.invoice_number as string,
    dispatchId: row.dispatch_id as string,
    totalAmount: Number(row.total_amount ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

// ---- Service ----

export const dbSalesService: SalesService = {
  // ── Sales Orders ─────────────────────────────────────────────────────

  async getSalesOrders(params) {
    return retryQuery(async () => {
      let query = getClient()
        .from("sales_orders")
        .select("id, so_number, customer_id, order_date, status, factory_id, created_at")
        .order("created_at", { ascending: false });
      if (params?.factory) {
        const factoryId = await getFactoryId(params.factory);
        if (factoryId) query = query.eq("factory_id", factoryId);
      }
      const { data, error } = await query;
      assertNoError(error);
      return Promise.all(
        (data ?? []).map(async (row) => {
          const factoryCode = await getFactoryCode(row.factory_id as string);
          return toSalesOrder(row, factoryCode);
        }),
      );
    });
  },

  async getSalesOrderById(soId) {
    const { data, error } = await getClient()
      .from("sales_orders")
      .select("*")
      .eq("id", soId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toSalesOrder(data, factoryCode);
  },

  async getSalesOrderItems(soId) {
    const { data, error } = await getClient()
      .from("so_items")
      .select("*")
      .eq("so_id", soId);
    assertNoError(error);
    return (data ?? []).map(toSalesOrderItem);
  },

  async createSalesOrder(input, actor) {
    if (!input.customerId) throw new Error("Customer is required.");
    if (!input.items || input.items.length === 0) throw new Error("At least one item is required.");
    const itemIds = input.items.map((i) => i.itemId).filter(Boolean);
    if (itemIds.length !== input.items.length) throw new Error("All items must have an item selected.");
    if (new Set(itemIds).size !== itemIds.length) throw new Error("Duplicate items are not allowed.");
    for (const item of input.items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0)
        throw new Error("All item quantities must be greater than 0.");
      if (!Number.isFinite(item.rate) || item.rate < 0)
        throw new Error("All item rates must be non-negative.");
    }

    const factoryId = input.factory ? await getFactoryId(input.factory) : null;
    const soNumber = await nextSONumber();
    const totalAmount = input.items.reduce((sum, i) => sum + i.quantity * i.rate, 0);

    const { data: so, error: soError } = await getClient()
      .from("sales_orders")
      .insert({
        so_number: soNumber,
        customer_id: input.customerId,
        factory_id: factoryId,
        status: "confirmed",
        order_date: input.orderDate ?? new Date().toISOString().slice(0, 10),
        total_amount: Number(totalAmount.toFixed(2)),
        created_by: actor?.id ?? null,
      })
      .select()
      .single();
    assertNoError(soError);

    const soItems = input.items.map((item) => ({
      so_id: so.id,
      item_id: item.itemId,
      quantity: item.quantity,
      uom: "NOS",
      unit_price: item.rate,
      total_amount: Number((item.quantity * item.rate).toFixed(2)),
    }));
    const { error: itemsError } = await getClient().from("so_items").insert(soItems);
    assertNoError(itemsError);

    return toSalesOrder(so, input.factory);
  },

  // ── Dispatches ───────────────────────────────────────────────────────

  async getDispatches(params) {
    return retryQuery(async () => {
      let query = getClient()
        .from("dispatches")
        .select("id, dispatch_number, so_id, dispatch_date, status, factory_id, created_at")
        .order("created_at", { ascending: false });
      if (params?.factory) {
        const factoryId = await getFactoryId(params.factory);
        if (factoryId) query = query.eq("factory_id", factoryId);
      }
      const { data, error } = await query;
      assertNoError(error);
      return Promise.all(
        (data ?? []).map(async (row) => {
          const factoryCode = await getFactoryCode(row.factory_id as string);
          return toDispatch(row, factoryCode);
        }),
      );
    });
  },

  async getDispatchById(dispatchId) {
    const { data, error } = await getClient()
      .from("dispatches")
      .select("*")
      .eq("id", dispatchId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toDispatch(data, factoryCode);
  },

  async getDispatchItems(dispatchId) {
    const { data, error } = await getClient()
      .from("dispatch_items")
      .select("*")
      .eq("dispatch_id", dispatchId);
    assertNoError(error);
    return (data ?? []).map(toDispatchItem);
  },

  async createDispatch(input, actor) {
    const { data: so, error: soError } = await getClient()
      .from("sales_orders")
      .select("factory_id, status")
      .eq("id", input.soId)
      .single();
    assertNoError(soError);
    if (!so) throw new Error("Sales order not found.");

    const soStatus = (so.status as string).toLowerCase();
    if (["invoiced", "closed", "cancelled"].includes(soStatus))
      throw new Error("Cannot create dispatch for a completed or cancelled sales order.");

    // Prevent duplicate pending dispatches
    const { count: pendingCount } = await getClient()
      .from("dispatches")
      .select("id", { count: "exact", head: true })
      .eq("so_id", input.soId)
      .in("status", ["draft", "pending"]);
    if (pendingCount && pendingCount > 0)
      throw new Error("A pending dispatch already exists for this sales order.");

    const dispatchNumber = await nextDispatchNumber();
    const { data, error } = await getClient()
      .from("dispatches")
      .insert({
        dispatch_number: dispatchNumber,
        so_id: input.soId,
        factory_id: so.factory_id,
        status: "draft",
        dispatch_date: input.dispatchDate ?? new Date().toISOString().slice(0, 10),
        created_by: actor?.id ?? null,
      })
      .select()
      .single();
    assertNoError(error);

    // Pre-populate dispatch_items from SO lines
    const { data: soItems } = await getClient()
      .from("so_items")
      .select("item_id, quantity, uom")
      .eq("so_id", input.soId);
    if (soItems && soItems.length > 0) {
      const dispItems = soItems.map((si) => ({
        dispatch_id: data.id,
        item_id: si.item_id,
        dispatched_qty: Number(si.quantity ?? 0),
        uom: (si.uom as string) ?? "NOS",
      }));
      await getClient().from("dispatch_items").insert(dispItems);
    }

    const factoryCode = await getFactoryCode(so.factory_id as string);
    return toDispatch(data, factoryCode);
  },

  async dispatchGoods(input, _actor) {
    const dispatch = await dbSalesService.getDispatchById(input.dispatchId);
    if (!dispatch) throw new Error("Dispatch not found.");
    if (dispatch.status !== "PENDING")
      throw new Error("Only pending dispatches can be processed.");

    if (!input.items || input.items.length === 0)
      throw new Error("At least one item must be dispatched.");
    for (const item of input.items) {
      if (!Number.isFinite(item.quantityDispatched) || item.quantityDispatched < 0)
        throw new Error("Dispatch quantities must be non-negative.");
    }
    const totalDispatched = input.items.reduce((s, i) => s + i.quantityDispatched, 0);
    if (totalDispatched <= 0)
      throw new Error("At least one item must have a positive dispatch quantity.");

    // Build SO item mapping and validate membership
    const { data: soItems } = await getClient()
      .from("so_items")
      .select("id, item_id, quantity")
      .eq("so_id", dispatch.soId);
    const soItemByItemId = new Map(
      (soItems ?? []).map((si) => [si.item_id as string, si]),
    );
    for (const item of input.items) {
      if (!soItemByItemId.has(item.itemId))
        throw new Error(`Item ${item.itemId} is not part of this sales order.`);
    }

    // Check stock availability before dispatch
    const factoryId = dispatch.factory ? await getFactoryId(dispatch.factory) : null;
    const dispatchItemIds = input.items.filter((i) => i.quantityDispatched > 0).map((i) => i.itemId);
    if (dispatchItemIds.length > 0) {
      let stockQuery = getClient().from("stock_ledger").select("item_id, quantity").in("item_id", dispatchItemIds);
      if (factoryId) stockQuery = stockQuery.eq("factory_id", factoryId);
      const { data: stockRows } = await stockQuery;
      const stock: Record<string, number> = {};
      for (const row of stockRows ?? []) {
        const id = row.item_id as string;
        stock[id] = (stock[id] ?? 0) + Number(row.quantity ?? 0);
      }
      for (const item of input.items) {
        if (item.quantityDispatched > 0) {
          const available = stock[item.itemId] ?? 0;
          if (available < item.quantityDispatched)
            throw new Error(
              `Insufficient stock for item ${item.itemId}: available ${available}, requested ${item.quantityDispatched}.`,
            );
        }
      }
    }

    // Update pre-populated dispatch_items with final dispatched quantities
    for (const i of input.items) {
      const { error: itemErr } = await getClient()
        .from("dispatch_items")
        .update({ dispatched_qty: i.quantityDispatched })
        .eq("dispatch_id", input.dispatchId)
        .eq("item_id", i.itemId);
      assertNoError(itemErr);
    }

    const { data, error } = await getClient()
      .from("dispatches")
      .update({ status: "dispatched" })
      .eq("id", input.dispatchId)
      .select()
      .single();
    assertNoError(error);

    // Post OUTWARD stock_ledger entries (negative quantity = outward)
    const ledgerEntries = input.items
      .filter((i) => i.quantityDispatched > 0)
      .map((i) => ({
        factory_id: factoryId,
        item_id: i.itemId,
        transaction_type: "dispatch",
        transaction_date: new Date().toISOString().slice(0, 10),
        quantity: -i.quantityDispatched,
        uom: "NOS",
        balance: -i.quantityDispatched,
        reference_type: "dispatch",
        reference_id: input.dispatchId,
      }));
    if (ledgerEntries.length > 0) {
      const { error: ledgerError } = await getClient()
        .from("stock_ledger")
        .insert(ledgerEntries);
      assertNoError(ledgerError);
    }

    return toDispatch(data, dispatch.factory);
  },

  // ── Invoices ─────────────────────────────────────────────────────────

  async getInvoices(params) {
    return retryQuery(async () => {
      let query = getClient()
        .from("invoices")
        .select("id, invoice_number, dispatch_id, total_amount, tax_amount, factory_id, created_at")
        .order("created_at", { ascending: false });
      if (params?.factory) {
        const factoryId = await getFactoryId(params.factory);
        if (factoryId) query = query.eq("factory_id", factoryId);
      }
      const { data, error } = await query;
      assertNoError(error);
      return Promise.all(
        (data ?? []).map(async (row) => {
          const factoryCode = await getFactoryCode(row.factory_id as string);
          return toInvoice(row, factoryCode);
        }),
      );
    });
  },

  async getInvoiceByDispatchId(dispatchId) {
    const { data, error } = await getClient()
      .from("invoices")
      .select("*")
      .eq("dispatch_id", dispatchId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toInvoice(data, factoryCode);
  },

  async generateInvoice(input, actor) {
    // Prevent duplicate invoices
    const existing = await dbSalesService.getInvoiceByDispatchId(input.dispatchId);
    if (existing) return existing;

    const dispatch = await dbSalesService.getDispatchById(input.dispatchId);
    if (!dispatch) throw new Error("Dispatch not found.");
    if (dispatch.status !== "DISPATCHED")
      throw new Error("Invoice can only be generated for a dispatched delivery.");

    // Aggregate line amounts from dispatch_items × so_items prices
    const [{ data: dispItems }, { data: so }] = await Promise.all([
      getClient()
        .from("dispatch_items")
        .select("item_id, dispatched_qty")
        .eq("dispatch_id", input.dispatchId),
      getClient()
        .from("sales_orders")
        .select("customer_id, factory_id")
        .eq("id", dispatch.soId)
        .single(),
    ]);
    if (!so) throw new Error("Sales order not found.");

    const { data: soItems } = await getClient()
      .from("so_items")
      .select("item_id, unit_price")
      .eq("so_id", dispatch.soId);

    const priceByItemId = new Map(
      (soItems ?? []).map((si) => [si.item_id as string, si]),
    );

    const DEFAULT_GST_PERCENT = 18;
    let subtotal = 0;
    for (const di of dispItems ?? []) {
      const si = priceByItemId.get(di.item_id as string);
      if (si) {
        subtotal += Number(di.dispatched_qty) * Number(si.unit_price);
      }
    }
    subtotal = Number(subtotal.toFixed(2));
    const taxAmount = Number((subtotal * DEFAULT_GST_PERCENT / 100).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    const invoiceNumber = await nextInvoiceNumber();
    const { data, error } = await getClient()
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        dispatch_id: input.dispatchId,
        customer_id: so.customer_id,
        factory_id: so.factory_id,
        status: "issued",
        invoice_date: new Date().toISOString().slice(0, 10),
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        created_by: actor?.id ?? null,
      })
      .select()
      .single();
    assertNoError(error);

    // Advance downstream statuses
    await Promise.all([
      getClient()
        .from("dispatches")
        .update({ status: "delivered" })
        .eq("id", input.dispatchId),
      getClient()
        .from("sales_orders")
        .update({ status: "invoiced" })
        .eq("id", dispatch.soId),
    ]);

    const factoryCode = await getFactoryCode(so.factory_id as string);
    return toInvoice(data, factoryCode);
  },
};
