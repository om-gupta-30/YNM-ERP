import type { FactoryCode, GateEntry, GRN, GRNItem, StockLedger } from "@/lib/types";
import type { InventoryService } from "@/lib/services/inventoryService";
import { assertNoError, getClient, getFactoryId, getFactoryCode, nowIso, retryQuery } from "./_helpers";

// ---- Schema mapping notes ----
// gate_entries.challan_number  → GateEntry.invoiceNumber
// gate_entries has no eway_bill_number column yet → ewayBillNumber defaults to ""
// grns.status ('accepted'|'partially_accepted'|'rejected'|'draft') → GRN.status
//   accepted|partially_accepted → APPROVED, rejected → REJECTED, draft → DRAFT
// stock_ledger.quantity is signed: positive = INWARD, negative = OUTWARD
// getCurrentStock sums quantity column (signed) to produce net stock per item.
// GRN approval posts INWARD stock_ledger entries for every accepted-qty line.

// ---- Sequence number helpers ----
// Uses COUNT to generate sequential numbers. In production, consider a dedicated
// sequences table or a DB SEQUENCE to avoid gaps under concurrency.

async function nextGENumber(): Promise<string> {
  const { count } = await getClient()
    .from("gate_entries")
    .select("*", { count: "exact", head: true });
  return `GE-YNM-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

async function nextGRNNumber(): Promise<string> {
  const { count } = await getClient()
    .from("grns")
    .select("*", { count: "exact", head: true });
  return `GRN-YNM-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

// ---- Row mappers ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGateEntry(row: Record<string, any>, factoryCode?: FactoryCode): GateEntry {
  return {
    id: row.id as string,
    gateEntryNumber: row.ge_number as string,
    poId: (row.po_id as string) ?? "",
    supplierId: (row.supplier_id as string) ?? "",
    vehicleNumber: (row.vehicle_number as string) ?? "",
    // DB stores invoice as challan_number; eway_bill_number column not yet added.
    invoiceNumber: (row.challan_number as string) ?? "",
    ewayBillNumber: "",
    status: ((row.status as string) ?? "open").toUpperCase() === "CLOSED" ? "CLOSED" : "OPEN",
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGRN(row: Record<string, any>, factoryCode?: FactoryCode): GRN {
  const dbStatus = (row.status as string).toUpperCase();
  let status: GRN["status"] = "DRAFT";
  if (dbStatus === "ACCEPTED") status = "APPROVED";
  else if (dbStatus === "PARTIALLY_ACCEPTED") status = "PARTIAL";
  else if (dbStatus === "REJECTED") status = "REJECTED";
  return {
    id: row.id as string,
    grnNumber: row.grn_number as string,
    gateEntryId: (row.gate_entry_id as string) ?? "",
    poId: (row.po_id as string) ?? "",
    status,
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGRNItem(row: Record<string, any>): GRNItem {
  return {
    id: row.id as string,
    grnId: row.grn_id as string,
    itemId: row.item_id as string,
    orderedQty: Number(row.ordered_qty ?? 0),
    receivedQty: Number(row.received_qty ?? 0),
    acceptedQty: Number(row.accepted_qty ?? 0),
    rejectedQty: Number(row.rejected_qty ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toStockLedger(row: Record<string, any>, factoryCode?: FactoryCode): StockLedger {
  const qty = Number(row.quantity ?? 0);
  const txType = row.transaction_type as string;
  return {
    id: row.id as string,
    itemId: row.item_id as string,
    // Positive quantity = INWARD; negative = OUTWARD.
    transactionType: qty >= 0 ? "INWARD" : "OUTWARD",
    quantity: Math.abs(qty),
    referenceType: mapReferenceType(txType),
    referenceId: (row.reference_id as string) ?? "",
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

function mapReferenceType(dbTxType: string): StockLedger["referenceType"] {
  const map: Record<string, StockLedger["referenceType"]> = {
    grn: "GRN",
    production_issue: "PRODUCTION",
    production_receipt: "PRODUCTION",
    dispatch: "DISPATCH",
  };
  return map[dbTxType] ?? "GRN";
}

// ---- Service ----

export const dbInventoryService: InventoryService = {
  // ── Gate Entries ──────────────────────────────────────────────────────

  async getGateEntries(params) {
    return retryQuery(async () => {
      let query = getClient()
        .from("gate_entries")
        .select("id, ge_number, po_id, supplier_id, vehicle_number, challan_number, status, factory_id, created_at")
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
          return toGateEntry(row, factoryCode);
        }),
      );
    });
  },

  async createGateEntry(input, actor) {
    if (!input.vehicleNumber?.trim()) throw new Error("Vehicle number is required.");
    if (!input.invoiceNumber?.trim()) throw new Error("Invoice/Challan number is required.");

    const factoryId = input.factory ? await getFactoryId(input.factory) : null;

    const { data: po, error: poError } = await getClient()
      .from("purchase_orders")
      .select("supplier_id, status, approved_by")
      .eq("id", input.poId)
      .single();
    assertNoError(poError);
    if (!po) throw new Error("PO not found.");
    const poStatus = (po.status as string).toLowerCase();
    if (!["acknowledged", "partially_received"].includes(poStatus))
      throw new Error("Gate entry can only be created for approved/acknowledged POs.");

    const geNumber = await nextGENumber();
    const { data, error } = await getClient()
      .from("gate_entries")
      .insert({
        ge_number: geNumber,
        factory_id: factoryId,
        po_id: input.poId,
        supplier_id: po.supplier_id,
        vehicle_number: input.vehicleNumber.trim(),
        challan_number: input.invoiceNumber.trim(),
        status: "open",
        entry_date: new Date().toISOString().slice(0, 10),
        created_by: actor?.id ?? null,
      })
      .select()
      .single();
    assertNoError(error);
    return toGateEntry(data, input.factory);
  },

  // ── GRNs ─────────────────────────────────────────────────────────────

  async getGRNs(params) {
    return retryQuery(async () => {
      let query = getClient()
        .from("grns")
        .select("id, grn_number, gate_entry_id, po_id, status, factory_id, created_at")
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
          return toGRN(row, factoryCode);
        }),
      );
    });
  },

  async getGRNById(grnId) {
    const { data, error } = await getClient()
      .from("grns")
      .select("*")
      .eq("id", grnId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toGRN(data, factoryCode);
  },

  async getGRNItems(grnId) {
    const { data, error } = await getClient()
      .from("grn_items")
      .select("*")
      .eq("grn_id", grnId);
    assertNoError(error);
    return (data ?? []).map(toGRNItem);
  },

  async createGRN(input, actor) {
    const { data: ge, error: geError } = await getClient()
      .from("gate_entries")
      .select("factory_id, po_id, status")
      .eq("id", input.gateEntryId)
      .single();
    assertNoError(geError);
    if (!ge) throw new Error("Gate entry not found.");

    // Prevent duplicate GRNs for the same gate entry
    const { count: existingCount } = await getClient()
      .from("grns")
      .select("id", { count: "exact", head: true })
      .eq("gate_entry_id", input.gateEntryId);
    if (existingCount && existingCount > 0)
      throw new Error("A GRN already exists for this gate entry.");

    const grnNumber = await nextGRNNumber();
    const { data, error } = await getClient()
      .from("grns")
      .insert({
        grn_number: grnNumber,
        gate_entry_id: input.gateEntryId,
        po_id: ge.po_id,
        factory_id: ge.factory_id,
        status: "draft",
        grn_date: new Date().toISOString().slice(0, 10),
        created_by: actor?.id ?? null,
      })
      .select()
      .single();
    assertNoError(error);

    // Pre-populate grn_items from the associated PO lines
    const { data: poItems } = await getClient()
      .from("po_items")
      .select("item_id, quantity, uom")
      .eq("po_id", ge.po_id);
    if (poItems && poItems.length > 0) {
      const grnItems = poItems.map((pi) => ({
        grn_id: data.id,
        item_id: pi.item_id,
        ordered_qty: Number(pi.quantity ?? 0),
        received_qty: 0,
        accepted_qty: 0,
        rejected_qty: 0,
        uom: (pi.uom as string) ?? "NOS",
      }));
      await getClient().from("grn_items").insert(grnItems);
    }

    const factoryCode = await getFactoryCode(ge.factory_id as string);
    return toGRN(data, factoryCode);
  },

  async approveGRN(input) {
    const grn = await dbInventoryService.getGRNById(input.grnId);
    if (!grn) throw new Error("GRN not found.");
    if (grn.status !== "DRAFT") throw new Error("Only draft GRNs can be approved.");

    // Per-line validation: quantities must be non-negative and acceptedQty <= receivedQty
    for (const item of input.items) {
      if (!Number.isFinite(item.receivedQty) || item.receivedQty < 0)
        throw new Error("Received quantity must be a non-negative number.");
      if (!Number.isFinite(item.acceptedQty) || item.acceptedQty < 0)
        throw new Error("Accepted quantity must be a non-negative number.");
      if (item.acceptedQty > item.receivedQty)
        throw new Error("Accepted quantity cannot exceed received quantity.");
    }

    const totalAccepted = input.items.reduce((sum, i) => sum + i.acceptedQty, 0);
    if (totalAccepted <= 0)
      throw new Error("At least one line must have accepted quantity > 0.");

    // Update each grn_item row individually
    for (const item of input.items) {
      await getClient()
        .from("grn_items")
        .update({
          received_qty: item.receivedQty,
          accepted_qty: item.acceptedQty,
          rejected_qty: item.receivedQty - item.acceptedQty,
        })
        .eq("grn_id", input.grnId)
        .eq("item_id", item.itemId);
    }

    const allAccepted = input.items.every((i) => i.acceptedQty >= i.receivedQty);
    const newStatus = allAccepted ? "accepted" : "partially_accepted";

    // Optimistic lock: only update if still draft (prevents concurrent double-approval)
    const { data, error } = await getClient()
      .from("grns")
      .update({ status: newStatus })
      .eq("id", input.grnId)
      .eq("status", "draft")
      .select()
      .single();
    assertNoError(error);
    if (!data) throw new Error("GRN was already processed by another user.");

    // Post INWARD stock_ledger entries for every line with accepted qty > 0
    const factoryId = grn.factory ? await getFactoryId(grn.factory) : null;
    const ledgerEntries = input.items
      .filter((i) => i.acceptedQty > 0)
      .map((i) => ({
        factory_id: factoryId,
        item_id: i.itemId,
        transaction_type: "grn",
        transaction_date: new Date().toISOString().slice(0, 10),
        quantity: i.acceptedQty,
        uom: "NOS",
        balance: i.acceptedQty,
        reference_type: "grn",
        reference_id: input.grnId,
      }));
    if (ledgerEntries.length > 0) {
      const { error: ledgerError } = await getClient()
        .from("stock_ledger")
        .insert(ledgerEntries);
      assertNoError(ledgerError);
    }

    // Close the gate entry after GRN approval
    if (grn.gateEntryId) {
      await getClient()
        .from("gate_entries")
        .update({ status: "closed" })
        .eq("id", grn.gateEntryId);
    }

    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toGRN(data, factoryCode);
  },

  async rejectGRN(input) {
    const grn = await dbInventoryService.getGRNById(input.grnId);
    if (!grn) throw new Error("GRN not found.");
    if (grn.status !== "DRAFT")
      throw new Error("Only draft GRNs can be rejected.");

    const { data, error } = await getClient()
      .from("grns")
      .update({ status: "rejected" })
      .eq("id", input.grnId)
      .eq("status", "draft")
      .select()
      .single();
    assertNoError(error);
    if (!data) throw new Error("GRN was already processed by another user.");

    // Close the gate entry after GRN rejection
    if (grn.gateEntryId) {
      await getClient()
        .from("gate_entries")
        .update({ status: "closed" })
        .eq("id", grn.gateEntryId);
    }

    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toGRN(data, factoryCode);
  },

  // ── Stock Ledger ──────────────────────────────────────────────────────

  async getStockLedger(params) {
    return retryQuery(async () => {
      let query = getClient()
        .from("stock_ledger")
        .select("id, item_id, transaction_type, quantity, reference_type, reference_id, factory_id, created_at")
        .order("created_at", { ascending: false });
      if (params?.factory) {
        const factoryId = await getFactoryId(params.factory);
        if (factoryId) query = query.eq("factory_id", factoryId);
      }
      if (params?.itemId) query = query.eq("item_id", params.itemId);
      if (params?.transactionType) {
        if (params.transactionType === "INWARD") query = query.gte("quantity", 0);
        else query = query.lt("quantity", 0);
      }
      const { data, error } = await query;
      assertNoError(error);
      return Promise.all(
        (data ?? []).map(async (row) => {
          const factoryCode = await getFactoryCode(row.factory_id as string);
          return toStockLedger(row, factoryCode);
        }),
      );
    });
  },

  async getCurrentStock(params) {
    return retryQuery(async () => {
      let query = getClient().from("stock_ledger").select("item_id, quantity");
      if (params?.factory) {
        const factoryId = await getFactoryId(params.factory);
        if (factoryId) query = query.eq("factory_id", factoryId);
      }
      const { data, error } = await query;
      assertNoError(error);
      const stock: Record<string, number> = {};
      for (const row of data ?? []) {
        const itemId = row.item_id as string;
        stock[itemId] = (stock[itemId] ?? 0) + Number(row.quantity ?? 0);
      }
      return stock;
    });
  },

  async getOpenPOs(params) {
    // 'acknowledged' = approved PO not yet received; 'partially_received' = partial receipt.
    let query = getClient()
      .from("purchase_orders")
      .select("id, po_number, supplier_id, status")
      .in("status", ["acknowledged", "partially_received"])
      .order("created_at", { ascending: false });
    if (params?.factory) {
      const factoryId = await getFactoryId(params.factory);
      if (factoryId) query = query.eq("factory_id", factoryId);
    }
    const { data, error } = await query;
    assertNoError(error);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      poNumber: row.po_number as string,
      supplierId: row.supplier_id as string,
      status: (row.status as string).toUpperCase(),
    }));
  },

  async postStockLedgerEntries(entries) {
    const valid = entries.filter((e) => Number.isFinite(e.quantity) && e.quantity > 0);
    if (!valid.length) return;

    const rows = await Promise.all(
      valid.map(async (e) => {
        const factoryId = e.factory ? await getFactoryId(e.factory) : null;
        const isInward = e.transactionType === "INWARD";
        return {
          factory_id: factoryId,
          item_id: e.itemId,
          transaction_type: e.referenceType.toLowerCase(),
          transaction_date: (e.createdAt ?? nowIso()).slice(0, 10),
          // Signed quantity: positive = INWARD, negative = OUTWARD
          quantity: isInward ? e.quantity : -e.quantity,
          uom: "NOS",
          // TODO: compute true running balance via DB function/trigger
          balance: isInward ? e.quantity : -e.quantity,
          reference_type: e.referenceType.toLowerCase(),
          reference_id: e.referenceId,
        };
      }),
    );

    const { error } = await getClient().from("stock_ledger").insert(rows);
    assertNoError(error);
  },
};
