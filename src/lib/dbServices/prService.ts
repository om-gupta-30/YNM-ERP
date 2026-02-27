import type {
  FactoryCode,
  PurchaseOrder,
  PurchaseRequisition,
  PurchaseRequisitionStatusEvent,
  RFQ,
  SupplierQuote,
} from "@/lib/types";
import type { PrService } from "@/lib/services/prService";
import { assertNoError, getClient, getFactoryId, getFactoryCode, nowIso, retryQuery } from "./_helpers";

// ---- Schema mapping notes ----
// purchase_requisitions.remarks stores the `department` field because there
// is no dedicated `department` column yet.
// TODO: Add `department TEXT` column to purchase_requisitions and migrate.
//
// approvePR / rejectPR do NOT write to remarks so the department value is
// preserved. The approval note is stored only in the synthesised history
// events, not persisted to the DB row (no dedicated note column exists).
//
// Status values (DB lowercase → app UPPERCASE via .toUpperCase()):
//   draft → DRAFT, submitted → SUBMITTED, approved → APPROVED,
//   rejected → REJECTED, closed → CLOSED

// ---- Sequence number helpers ----
// Uses COUNT to generate sequential numbers. In production, consider a
// dedicated sequences table or a DB SEQUENCE to avoid gaps under concurrency.

async function nextPRNumber(): Promise<string> {
  const { count } = await getClient()
    .from("purchase_requisitions")
    .select("*", { count: "exact", head: true });
  return `PR-YNM-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

async function nextRFQNumber(): Promise<string> {
  const { count } = await getClient()
    .from("rfqs")
    .select("*", { count: "exact", head: true });
  return `RFQ-YNM-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

async function nextPONumber(): Promise<string> {
  const { count } = await getClient()
    .from("purchase_orders")
    .select("*", { count: "exact", head: true });
  return `PO-YNM-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

// ---- Row mappers ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPR(row: Record<string, any>, factoryCode?: FactoryCode): PurchaseRequisition {
  return {
    id: row.id as string,
    prNumber: row.pr_number as string,
    requestedBy: (row.raised_by as string) ?? "",
    // remarks stores department until a dedicated column is added
    department: (row.remarks as string) ?? "",
    status: (row.status as string).toUpperCase() as PurchaseRequisition["status"],
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPO(row: Record<string, any>, factoryCode?: FactoryCode): PurchaseOrder {
  const dbStatus = row.status as string;
  const approvedBy = row.approved_by as string | null;

  let status: PurchaseOrder["status"] = "OPEN";
  let approvalStatus: PurchaseOrder["approvalStatus"] = "PENDING";

  if (dbStatus === "partially_received") {
    status = "PARTIAL";
    approvalStatus = "APPROVED";
  } else if (["received", "closed"].includes(dbStatus)) {
    status = "CLOSED";
    approvalStatus = "APPROVED";
  } else if (dbStatus === "cancelled") {
    status = "CLOSED";
    approvalStatus = "REJECTED";
  } else if (dbStatus === "acknowledged" || approvedBy) {
    status = "APPROVED";
    approvalStatus = "APPROVED";
  }

  return {
    id: row.id as string,
    poNumber: row.po_number as string,
    supplierId: row.supplier_id as string,
    linkedRfqId: (row.rfq_id as string) ?? "",
    status,
    approvalStatus,
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRFQ(row: Record<string, any>, supplierIds: string[], factoryCode?: FactoryCode): RFQ {
  const dbStatus = (row.status as string).toUpperCase();
  const statusMap: Record<string, RFQ["status"]> = {
    DRAFT: "DRAFT",
    SENT: "SENT",
    RECEIVED: "QUOTED",
    CLOSED: "CLOSED",
    CANCELLED: "CLOSED",
  };
  return {
    id: row.id as string,
    rfqNumber: row.rfq_number as string,
    linkedPrId: (row.pr_id as string) ?? "",
    selectedSuppliers: supplierIds,
    status: statusMap[dbStatus] ?? "DRAFT",
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichRFQ(row: Record<string, any>, factoryCode?: FactoryCode): Promise<RFQ> {
  const { data } = await getClient()
    .from("rfq_suppliers")
    .select("supplier_id")
    .eq("rfq_id", row.id as string);
  const supplierIds = (data ?? []).map((r) => r.supplier_id as string);
  return toRFQ(row, supplierIds, factoryCode);
}

function toSupplierQuote(
  rfqId: string,
  supplierId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, any>[],
): SupplierQuote {
  return {
    id: `sq_${rfqId}_${supplierId}`,
    rfqId,
    supplierId,
    itemQuotes: rows.map((r) => ({
      itemId: r.item_id as string,
      unitPrice: Number(r.unit_price),
      taxPercent: Number(r.tax_percent ?? 0),
      deliveryDays: Number(r.lead_time_days ?? 0),
    })),
  };
}

// ---- Service ----

export const dbPrService: PrService = {
  // ── PRs ──────────────────────────────────────────────────────────────

  async getPRs(params) {
    return retryQuery(async () => {
      let query = getClient()
        .from("purchase_requisitions")
        .select("id, pr_number, raised_by, remarks, status, factory_id, created_at")
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
          return toPR(row, factoryCode);
        }),
      );
    });
  },

  async getPRById(prId) {
    const { data, error } = await getClient()
      .from("purchase_requisitions")
      .select("*")
      .eq("id", prId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toPR(data, factoryCode);
  },

  async getPRItems(prId) {
    const { data, error } = await getClient()
      .from("pr_items")
      .select("*")
      .eq("pr_id", prId)
      .is("deleted_at", null);
    assertNoError(error);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      prId: row.pr_id as string,
      itemId: row.item_id as string,
      quantity: Number(row.quantity),
      remarks: (row.remarks as string) ?? "",
    }));
  },

  async getPRHistory(prId) {
    // Synthesises history from the PR record because there is no dedicated
    // pr_status_history table yet.
    // TODO: Add pr_status_history for a full audit trail.
    const { data, error } = await getClient()
      .from("purchase_requisitions")
      .select("id, status, created_at, raised_by, approved_by, approved_at")
      .eq("id", prId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return [];

    const events: PurchaseRequisitionStatusEvent[] = [
      {
        id: `${prId}_created`,
        prId,
        status: "DRAFT",
        at: data.created_at as string,
        by: (data.raised_by as string) ?? "",
      },
    ];

    const dbStatus = (data.status as string).toLowerCase();
    if (dbStatus !== "draft") {
      events.push({
        id: `${prId}_submitted`,
        prId,
        status: "SUBMITTED",
        at: data.created_at as string,
        by: (data.raised_by as string) ?? "",
      });
    }

    if (data.approved_at) {
      const isApproved = dbStatus === "approved";
      events.push({
        id: `${prId}_reviewed`,
        prId,
        status: isApproved ? "APPROVED" : "REJECTED",
        at: data.approved_at as string,
        by: (data.approved_by as string) ?? "",
      });
    }

    return events;
  },

  async createPR(input) {
    if (!input.requestedBy?.trim()) throw new Error("Requested by is required.");
    if (!input.department?.trim()) throw new Error("Department is required.");
    if (!input.items || input.items.length === 0) throw new Error("At least one item is required.");
    const itemIds = input.items.map((i) => i.itemId).filter(Boolean);
    if (itemIds.length !== input.items.length) throw new Error("All items must have an item selected.");
    if (new Set(itemIds).size !== itemIds.length) throw new Error("Duplicate items are not allowed.");
    for (const item of input.items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0)
        throw new Error("All item quantities must be greater than 0.");
    }

    const factoryId = input.factory ? await getFactoryId(input.factory) : null;
    const prNumber = await nextPRNumber();

    const { data: pr, error: prError } = await getClient()
      .from("purchase_requisitions")
      .insert({
        pr_number: prNumber,
        factory_id: factoryId,
        raised_by: input.requestedBy.trim(),
        remarks: input.department.trim(),
        status: "draft",
      })
      .select()
      .single();
    assertNoError(prError);

    const prItems = input.items.map((item) => ({
      pr_id: pr.id,
      item_id: item.itemId,
      quantity: item.quantity,
      uom: "NOS",
      remarks: item.remarks,
    }));
    const { error: itemsError } = await getClient().from("pr_items").insert(prItems);
    assertNoError(itemsError);

    return toPR(pr, input.factory);
  },

  async updatePR(input) {
    const { data: current, error: checkErr } = await getClient()
      .from("purchase_requisitions")
      .select("status")
      .eq("id", input.prId)
      .single();
    assertNoError(checkErr);
    if (!current) throw new Error("PR not found.");
    if ((current.status as string) !== "draft")
      throw new Error("Only draft PRs can be edited.");

    const { data: pr, error: prError } = await getClient()
      .from("purchase_requisitions")
      .update({ remarks: input.department })
      .eq("id", input.prId)
      .select()
      .single();
    assertNoError(prError);
    if (!pr) throw new Error("PR not found.");

    // Soft-delete existing items, then insert replacements
    await getClient().from("pr_items").update({ deleted_at: nowIso() }).eq("pr_id", input.prId).is("deleted_at", null);
    if (input.items.length > 0) {
      const prItems = input.items.map((item) => ({
        pr_id: input.prId,
        item_id: item.itemId,
        quantity: item.quantity,
        uom: "NOS",
        remarks: item.remarks,
      }));
      const { error: itemsError } = await getClient().from("pr_items").insert(prItems);
      assertNoError(itemsError);
    }

    const factoryCode = await getFactoryCode(pr.factory_id as string);
    return toPR(pr, factoryCode);
  },

  async submitPR(input) {
    const { data: current, error: checkErr } = await getClient()
      .from("purchase_requisitions")
      .select("status")
      .eq("id", input.prId)
      .single();
    assertNoError(checkErr);
    if (!current) throw new Error("PR not found.");
    if ((current.status as string) !== "draft")
      throw new Error("Only draft PRs can be submitted.");

    const { data, error } = await getClient()
      .from("purchase_requisitions")
      .update({ status: "submitted" })
      .eq("id", input.prId)
      .select()
      .single();
    assertNoError(error);
    if (!data) throw new Error("PR not found.");
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toPR(data, factoryCode);
  },

  async approvePR(input) {
    const { data: current, error: checkErr } = await getClient()
      .from("purchase_requisitions")
      .select("status")
      .eq("id", input.prId)
      .single();
    assertNoError(checkErr);
    if (!current) throw new Error("PR not found.");
    if ((current.status as string) !== "submitted")
      throw new Error("Only submitted PRs can be approved.");

    const { data, error } = await getClient()
      .from("purchase_requisitions")
      .update({
        status: "approved",
        approved_by: input.by,
        approved_at: nowIso(),
      })
      .eq("id", input.prId)
      .select()
      .single();
    assertNoError(error);
    if (!data) throw new Error("PR not found.");
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toPR(data, factoryCode);
  },

  async rejectPR(input) {
    const { data: current, error: checkErr } = await getClient()
      .from("purchase_requisitions")
      .select("status")
      .eq("id", input.prId)
      .single();
    assertNoError(checkErr);
    if (!current) throw new Error("PR not found.");
    if ((current.status as string) !== "submitted")
      throw new Error("Only submitted PRs can be rejected.");

    const { data, error } = await getClient()
      .from("purchase_requisitions")
      .update({
        status: "rejected",
        approved_by: input.by,
        approved_at: nowIso(),
      })
      .eq("id", input.prId)
      .select()
      .single();
    assertNoError(error);
    if (!data) throw new Error("PR not found.");
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toPR(data, factoryCode);
  },

  // ── RFQs ─────────────────────────────────────────────────────────────

  async getRFQs(params) {
    return retryQuery(async () => {
      let query = getClient()
        .from("rfqs")
        .select("id, rfq_number, pr_id, status, factory_id, created_at")
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
          return enrichRFQ(row, factoryCode);
        }),
      );
    });
  },

  async getRFQById(rfqId) {
    const { data, error } = await getClient()
      .from("rfqs")
      .select("*")
      .eq("id", rfqId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return enrichRFQ(data, factoryCode);
  },

  async createRFQ(input, actor) {
    if (!input.selectedSuppliers || input.selectedSuppliers.length === 0)
      throw new Error("At least one supplier must be selected.");
    if (new Set(input.selectedSuppliers).size !== input.selectedSuppliers.length)
      throw new Error("Duplicate suppliers are not allowed.");

    const { data: pr, error: prError } = await getClient()
      .from("purchase_requisitions")
      .select("factory_id, status")
      .eq("id", input.linkedPrId)
      .single();
    assertNoError(prError);
    if (!pr) throw new Error("PR not found.");
    if ((pr.status as string) !== "approved")
      throw new Error("RFQ can only be created from an approved PR.");

    const rfqNumber = await nextRFQNumber();
    const { data: rfq, error: rfqError } = await getClient()
      .from("rfqs")
      .insert({
        rfq_number: rfqNumber,
        pr_id: input.linkedPrId,
        factory_id: pr?.factory_id ?? null,
        created_by: actor?.id ?? null,
        status: "draft",
      })
      .select()
      .single();
    assertNoError(rfqError);

    const rfqSuppliers = input.selectedSuppliers.map((supplierId) => ({
      rfq_id: rfq.id,
      supplier_id: supplierId,
      status: "pending",
    }));
    const { error: supError } = await getClient().from("rfq_suppliers").insert(rfqSuppliers);
    assertNoError(supError);

    const factoryCode = await getFactoryCode(rfq.factory_id as string);
    return toRFQ(rfq, input.selectedSuppliers, factoryCode);
  },

  async submitRFQ(input) {
    const { data: current, error: checkErr } = await getClient()
      .from("rfqs")
      .select("status")
      .eq("id", input.rfqId)
      .single();
    assertNoError(checkErr);
    if (!current) throw new Error("RFQ not found.");
    if ((current.status as string) !== "draft")
      throw new Error("Only draft RFQs can be sent.");

    const { data, error } = await getClient()
      .from("rfqs")
      .update({ status: "sent" })
      .eq("id", input.rfqId)
      .select()
      .single();
    assertNoError(error);
    if (!data) throw new Error("RFQ not found.");

    await getClient()
      .from("rfq_suppliers")
      .update({ status: "sent", sent_at: nowIso() })
      .eq("rfq_id", input.rfqId);

    const factoryCode = await getFactoryCode(data.factory_id as string);
    return enrichRFQ(data, factoryCode);
  },

  async addSupplierQuote(input) {
    // Validate RFQ is in a state that accepts quotes
    const { data: rfqRow, error: rfqErr } = await getClient()
      .from("rfqs")
      .select("status")
      .eq("id", input.rfqId)
      .single();
    assertNoError(rfqErr);
    if (!rfqRow) throw new Error("RFQ not found.");
    const rfqStatus = (rfqRow.status as string).toLowerCase();
    if (rfqStatus !== "sent" && rfqStatus !== "received")
      throw new Error("Quotes can only be added to sent or in-progress RFQs.");

    if (!input.itemQuotes || input.itemQuotes.length === 0)
      throw new Error("At least one item quote is required.");
    for (const iq of input.itemQuotes) {
      if (!Number.isFinite(iq.unitPrice) || iq.unitPrice < 0)
        throw new Error("Unit price must be a non-negative number.");
      if (!Number.isFinite(iq.deliveryDays) || iq.deliveryDays < 0)
        throw new Error("Delivery days must be a non-negative number.");
    }

    const { data: rfqSup, error: rsError } = await getClient()
      .from("rfq_suppliers")
      .select("id")
      .eq("rfq_id", input.rfqId)
      .eq("supplier_id", input.supplierId)
      .single();
    assertNoError(rsError);
    if (!rfqSup) throw new Error("Supplier not found on this RFQ.");

    // Upsert: soft-delete existing quotes for this rfq_supplier, then re-insert
    await getClient().from("supplier_quotes").update({ deleted_at: nowIso() }).eq("rfq_supplier_id", rfqSup.id).is("deleted_at", null);

    const rows = input.itemQuotes.map((iq) => ({
      rfq_supplier_id: rfqSup.id,
      item_id: iq.itemId,
      quantity: 1,
      uom: "NOS",
      unit_price: iq.unitPrice,
      tax_percent: iq.taxPercent,
      lead_time_days: iq.deliveryDays,
    }));
    const { error: insertError } = await getClient().from("supplier_quotes").insert(rows);
    assertNoError(insertError);

    await getClient()
      .from("rfq_suppliers")
      .update({ status: "quoted", responded_at: nowIso() })
      .eq("id", rfqSup.id);

    // Advance RFQ to 'received' if all suppliers have responded
    const { data: allSups } = await getClient()
      .from("rfq_suppliers")
      .select("status")
      .eq("rfq_id", input.rfqId);
    const allResponded = (allSups ?? []).every(
      (s) => s.status === "quoted" || s.status === "declined",
    );
    if (allResponded) {
      await getClient().from("rfqs").update({ status: "received" }).eq("id", input.rfqId);
    }

    return toSupplierQuote(input.rfqId, input.supplierId, rows);
  },

  async getSupplierQuotes(rfqId) {
    const { data: rfqSups, error } = await getClient()
      .from("rfq_suppliers")
      .select("id, supplier_id")
      .eq("rfq_id", rfqId);
    assertNoError(error);

    const quotes: SupplierQuote[] = [];
    for (const rfqSup of rfqSups ?? []) {
      const { data: sqRows } = await getClient()
        .from("supplier_quotes")
        .select("*")
        .eq("rfq_supplier_id", rfqSup.id)
        .is("deleted_at", null);
      if (sqRows && sqRows.length > 0) {
        quotes.push(toSupplierQuote(rfqId, rfqSup.supplier_id as string, sqRows));
      }
    }
    return quotes;
  },

  async getComparisonData(rfqId) {
    const rfq = await dbPrService.getRFQById(rfqId);
    if (!rfq) throw new Error("RFQ not found.");

    const [prItems, quotes, suppliersRes, itemsRes] = await Promise.all([
      dbPrService.getPRItems(rfq.linkedPrId),
      dbPrService.getSupplierQuotes(rfqId),
      getClient().from("suppliers").select("id, code, name").in("id", rfq.selectedSuppliers),
      getClient().from("items").select("id, code, name, uom"),
    ]);
    assertNoError(suppliersRes.error);
    assertNoError(itemsRes.error);

    const itemById = new Map((itemsRes.data ?? []).map((i) => [i.id as string, i]));
    const quoteBySupplier = new Map(quotes.map((q) => [q.supplierId, q]));

    function landed(unitPrice: number, taxPercent: number): number {
      return Number((unitPrice * (1 + taxPercent / 100)).toFixed(4));
    }

    const lines = prItems.map((pi) => {
      const it = itemById.get(pi.itemId);
      const perSupplier = rfq.selectedSuppliers.map((supplierId) => {
        const sq = quoteBySupplier.get(supplierId);
        const iq = sq?.itemQuotes.find((x) => x.itemId === pi.itemId);
        const unitPrice = iq?.unitPrice ?? null;
        const taxPercent = iq?.taxPercent ?? null;
        const deliveryDays = iq?.deliveryDays ?? null;
        const landedUnit =
          unitPrice != null && taxPercent != null ? landed(unitPrice, taxPercent) : null;
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

      const lowestSup = perSupplier
        .filter((p) => p.landedUnit != null)
        .sort((a, b) => a.landedUnit! - b.landedUnit!)[0];

      return {
        prItemId: pi.id,
        itemId: pi.itemId,
        itemCode: (it?.code as string) ?? "—",
        itemName: (it?.name as string) ?? "—",
        uom: ((it?.uom as string) ?? "NOS") as "NOS" | "KG" | "MTR",
        quantity: pi.quantity,
        remarks: pi.remarks,
        perSupplier,
        lowestSupplierId: lowestSup?.supplierId ?? null,
      };
    });

    const totalsBySupplier = rfq.selectedSuppliers.map((supplierId) => {
      const cells = lines.map((l) => l.perSupplier.find((p) => p.supplierId === supplierId));
      const hasAllQuotes = cells.every((c) => c?.lineTotal != null);
      const total = hasAllQuotes
        ? cells.reduce((sum, c) => sum + (c?.lineTotal ?? 0), 0)
        : 0;
      return { supplierId, total: Number(total.toFixed(2)), _complete: hasAllQuotes };
    });

    // Only consider suppliers who quoted on ALL items for best-overall
    const quotedSuppliers = totalsBySupplier.filter((s) => s._complete);
    const bestOverall = quotedSuppliers.sort((a, b) => a.total - b.total)[0];

    return {
      rfq,
      suppliers: (suppliersRes.data ?? []).map((s) => ({
        id: s.id as string,
        supplierCode: s.code as string,
        supplierName: s.name as string,
      })),
      lines,
      totalsBySupplier,
      bestOverallSupplierId: bestOverall?.supplierId ?? null,
    };
  },

  async generatePO(input, actor) {
    const rfq = await dbPrService.getRFQById(input.rfqId);
    if (!rfq) throw new Error("RFQ not found.");
    if (rfq.status === "CLOSED") throw new Error("RFQ already closed.");
    if (rfq.status === "DRAFT" || rfq.status === "SENT")
      throw new Error("PO can only be generated after all supplier quotes are received.");
    if (!rfq.selectedSuppliers.includes(input.supplierId))
      throw new Error("Supplier not selected for this RFQ.");

    const quotes = await dbPrService.getSupplierQuotes(input.rfqId);
    const sq = quotes.find((q) => q.supplierId === input.supplierId);
    if (!sq) throw new Error("No quote found for selected supplier.");

    const prItems = await dbPrService.getPRItems(rfq.linkedPrId);
    for (const pi of prItems) {
      if (!sq.itemQuotes.find((x) => x.itemId === pi.itemId))
        throw new Error("Selected supplier quote is incomplete for all PR items.");
    }

    const factoryId = rfq.factory ? await getFactoryId(rfq.factory) : null;
    const poNumber = await nextPONumber();

    const { data: po, error: poError } = await getClient()
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        supplier_id: input.supplierId,
        factory_id: factoryId,
        rfq_id: input.rfqId,
        created_by: actor?.id ?? null,
        status: "draft",
        po_date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    assertNoError(poError);

    const poItems = prItems.map((pi) => {
      const iq = sq.itemQuotes.find((x) => x.itemId === pi.itemId)!;
      const lineTotal = Number(
        (iq.unitPrice * pi.quantity * (1 + iq.taxPercent / 100)).toFixed(2),
      );
      return {
        po_id: po.id,
        item_id: pi.itemId,
        quantity: pi.quantity,
        uom: "NOS",
        unit_price: iq.unitPrice,
        tax_percent: iq.taxPercent,
        total_amount: lineTotal,
      };
    });
    const { error: itemsError } = await getClient().from("po_items").insert(poItems);
    assertNoError(itemsError);

    await getClient().from("rfqs").update({ status: "closed" }).eq("id", input.rfqId);

    return toPO(po, rfq.factory);
  },

  // ── POs ──────────────────────────────────────────────────────────────

  async getPOs(params) {
    return retryQuery(async () => {
      let query = getClient()
        .from("purchase_orders")
        .select("id, po_number, supplier_id, rfq_id, status, approved_by, factory_id, created_at")
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
          return toPO(row, factoryCode);
        }),
      );
    });
  },

  async getPOById(poId) {
    const { data, error } = await getClient()
      .from("purchase_orders")
      .select("*")
      .eq("id", poId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toPO(data, factoryCode);
  },

  async approvePO(input, actor) {
    const { data: current } = await getClient()
      .from("purchase_orders")
      .select("status, approved_by")
      .eq("id", input.poId)
      .single();
    if (!current) throw new Error("PO not found.");
    if (current.approved_by) return dbPrService.getPOById(input.poId) as Promise<PurchaseOrder>;
    if (current.status === "cancelled") throw new Error("Cancelled POs cannot be approved.");
    const poStatus = current.status as string;
    if (!["draft", "open"].includes(poStatus))
      throw new Error("Only pending POs can be approved.");

    const { data, error } = await getClient()
      .from("purchase_orders")
      .update({
        status: "acknowledged",
        approved_by: actor?.id ?? null,
        approved_at: nowIso(),
      })
      .eq("id", input.poId)
      .select()
      .single();
    assertNoError(error);
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toPO(data, factoryCode);
  },

  async rejectPO(input, _actor) {
    const { data: current } = await getClient()
      .from("purchase_orders")
      .select("status, approved_by")
      .eq("id", input.poId)
      .single();
    if (!current) throw new Error("PO not found.");
    // Idempotent: already cancelled
    if (current.status === "cancelled")
      return dbPrService.getPOById(input.poId) as Promise<PurchaseOrder>;
    if (current.approved_by) throw new Error("Approved POs cannot be rejected.");

    const { data, error } = await getClient()
      .from("purchase_orders")
      .update({ status: "cancelled" })
      .eq("id", input.poId)
      .select()
      .single();
    assertNoError(error);
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toPO(data, factoryCode);
  },
};
