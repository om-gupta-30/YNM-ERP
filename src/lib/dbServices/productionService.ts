import type { FactoryCode, ProductionIssue, ProductionPunch, WorkOrder } from "@/lib/types";
import type { ProductionService } from "@/lib/services/productionService";
import { assertNoError, getClient, getFactoryId, getFactoryCode, nowIso, retryQuery } from "./_helpers";

async function getCurrentStockForItems(
  itemIds: string[],
  factoryId: string | null,
): Promise<Record<string, number>> {
  let query = getClient().from("stock_ledger").select("item_id, quantity").in("item_id", itemIds);
  if (factoryId) query = query.eq("factory_id", factoryId);
  const { data } = await query;
  const stock: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.item_id as string;
    stock[id] = (stock[id] ?? 0) + Number(row.quantity ?? 0);
  }
  return stock;
}

// ---- Schema mapping notes ----
// work_orders.item_id          → WorkOrder.finishedGoodItemId
// work_orders.planned_qty      → WorkOrder.quantityPlanned
// work_orders.status mapping:
//   draft|released → OPEN, in_progress → IN_PROGRESS,
//   completed|cancelled → COMPLETED
// production_issues.issued_qty → ProductionIssue.quantityIssued
// production_punches.produced_qty → ProductionPunch.quantityProduced
// production_punches.rejected_qty → ProductionPunch.scrapQuantity
//
// Stock ledger posting:
//   issueMaterials  → OUTWARD entries (negative quantity) in stock_ledger
//   punchProduction → INWARD entry (positive quantity) for finished good

// ---- Sequence number helper ----
// Uses COUNT to generate sequential numbers.

async function nextWONumber(): Promise<string> {
  const { count } = await getClient()
    .from("work_orders")
    .select("*", { count: "exact", head: true });
  return `WO-YNM-${String((count ?? 0) + 101).padStart(4, "0")}`;
}

// ---- Row mappers ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toWorkOrder(row: Record<string, any>, factoryCode?: FactoryCode): WorkOrder {
  return {
    id: row.id as string,
    woNumber: row.wo_number as string,
    finishedGoodItemId: row.item_id as string,
    bomId: (row.bom_id as string) ?? "",
    quantityPlanned: Number(row.planned_qty),
    status: mapWOStatus(row.status as string),
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

function mapWOStatus(dbStatus: string): WorkOrder["status"] {
  const map: Record<string, WorkOrder["status"]> = {
    draft: "OPEN",
    released: "OPEN",
    in_progress: "IN_PROGRESS",
    completed: "COMPLETED",
    cancelled: "COMPLETED",
  };
  return map[dbStatus] ?? "OPEN";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProductionIssue(row: Record<string, any>, factoryCode?: FactoryCode): ProductionIssue {
  return {
    id: row.id as string,
    workOrderId: row.work_order_id as string,
    itemId: row.item_id as string,
    quantityIssued: Number(row.issued_qty),
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProductionPunch(row: Record<string, any>, factoryCode?: FactoryCode): ProductionPunch {
  return {
    id: row.id as string,
    workOrderId: row.work_order_id as string,
    quantityProduced: Number(row.produced_qty),
    scrapQuantity: Number(row.rejected_qty ?? 0),
    factory: factoryCode,
    createdAt: row.created_at as string,
  };
}

// ---- Service ----

export const dbProductionService: ProductionService = {
  async getWorkOrders(params) {
    return retryQuery(async () => {
      let query = getClient()
        .from("work_orders")
        .select("id, wo_number, item_id, bom_id, planned_qty, status, factory_id, created_at")
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
          return toWorkOrder(row, factoryCode);
        }),
      );
    });
  },

  async getWorkOrderById(workOrderId) {
    const { data, error } = await getClient()
      .from("work_orders")
      .select("*")
      .eq("id", workOrderId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toWorkOrder(data, factoryCode);
  },

  async createWorkOrder(input, actor) {
    if (!input.finishedGoodItemId) throw new Error("Finished good is required.");
    if (!Number.isFinite(input.quantityPlanned) || input.quantityPlanned <= 0)
      throw new Error("Planned quantity must be > 0.");

    // Resolve the latest active BOM for this finished good
    const { data: bom } = await getClient()
      .from("bom_master")
      .select("id")
      .eq("finished_item_id", input.finishedGoodItemId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!bom) throw new Error("No active BOM found for selected finished good.");

    const factoryId = input.factory ? await getFactoryId(input.factory) : null;
    const woNumber = await nextWONumber();

    const { data, error } = await getClient()
      .from("work_orders")
      .insert({
        wo_number: woNumber,
        factory_id: factoryId,
        item_id: input.finishedGoodItemId,
        bom_id: bom.id,
        planned_qty: input.quantityPlanned,
        uom: "NOS",
        status: "released",
        created_by: actor?.id ?? null,
      })
      .select()
      .single();
    assertNoError(error);
    return toWorkOrder(data, input.factory);
  },

  async getRequiredMaterials(workOrderId) {
    const wo = await dbProductionService.getWorkOrderById(workOrderId);
    if (!wo) throw new Error("Work order not found.");

    const { data: bomItems, error } = await getClient()
      .from("bom_items")
      .select("component_item_id, quantity, scrap_percent")
      .eq("bom_id", wo.bomId);
    assertNoError(error);

    const required = (bomItems ?? []).map((b) => {
      const scrapFactor = 1 + Number(b.scrap_percent ?? 0) / 100;
      const requiredQty = Number(
        (Number(b.quantity) * wo.quantityPlanned * scrapFactor).toFixed(6),
      );
      return {
        itemId: b.component_item_id as string,
        requiredQty,
        scrapPercentage: Number(b.scrap_percent ?? 0),
        quantityPerUnit: Number(b.quantity),
      };
    });

    return { workOrder: wo, required };
  },

  async issueMaterials(input, actor) {
    const wo = await dbProductionService.getWorkOrderById(input.workOrderId);
    if (!wo) throw new Error("Work order not found.");
    if (wo.status === "COMPLETED")
      throw new Error("Cannot issue materials to a completed work order.");

    const ids = input.issues.map((i) => i.itemId).filter(Boolean);
    if (!ids.length) throw new Error("No issue lines provided.");
    if (new Set(ids).size !== ids.length)
      throw new Error("Duplicate issue items are not allowed.");

    // Validate per-line quantities
    for (const issue of input.issues) {
      if (!Number.isFinite(issue.quantityIssued) || issue.quantityIssued <= 0)
        throw new Error("Quantity issued must be greater than 0 for all items.");
    }

    // Validate items belong to the BOM
    const { data: bomItems } = await getClient()
      .from("bom_items")
      .select("component_item_id")
      .eq("bom_id", wo.bomId);
    const bomItemIds = new Set((bomItems ?? []).map((b) => b.component_item_id as string));
    for (const issue of input.issues) {
      if (!bomItemIds.has(issue.itemId))
        throw new Error(`Item ${issue.itemId} is not part of the BOM for this work order.`);
    }

    // Check stock availability before issuing
    const factoryId = wo.factory ? await getFactoryId(wo.factory) : null;
    const stock = await getCurrentStockForItems(ids, factoryId);
    for (const issue of input.issues) {
      const available = stock[issue.itemId] ?? 0;
      if (available < issue.quantityIssued)
        throw new Error(
          `Insufficient stock for item ${issue.itemId}: available ${available}, requested ${issue.quantityIssued}.`,
        );
    }

    // Insert production_issues rows
    const rows = input.issues.map((i) => ({
      work_order_id: input.workOrderId,
      item_id: i.itemId,
      issued_qty: i.quantityIssued,
      uom: "NOS",
      issued_by: actor?.id ?? null,
      issued_at: nowIso(),
    }));
    const { error } = await getClient().from("production_issues").insert(rows);
    assertNoError(error);

    // Post OUTWARD stock_ledger entries (negative quantity = outward)
    const ledgerEntries = input.issues.map((i) => ({
      factory_id: factoryId,
      item_id: i.itemId,
      transaction_type: "production_issue",
      transaction_date: new Date().toISOString().slice(0, 10),
      quantity: -i.quantityIssued,
      uom: "NOS",
      balance: -i.quantityIssued,
      reference_type: "work_order",
      reference_id: input.workOrderId,
    }));
    const { error: ledgerError } = await getClient()
      .from("stock_ledger")
      .insert(ledgerEntries);
    assertNoError(ledgerError);

    // Advance WO status to in_progress on first material issue
    if (wo.status === "OPEN") {
      await getClient()
        .from("work_orders")
        .update({ status: "in_progress", actual_start: nowIso() })
        .eq("id", input.workOrderId);
    }
  },

  async punchProduction(input, actor) {
    const wo = await dbProductionService.getWorkOrderById(input.workOrderId);
    if (!wo) throw new Error("Work order not found.");
    if (wo.status === "COMPLETED") throw new Error("Work order is already completed.");
    if (wo.status === "OPEN") throw new Error("Issue materials before punching production.");

    if (!Number.isFinite(input.quantityProduced) || input.quantityProduced < 0)
      throw new Error("Produced quantity must be a non-negative number.");
    if (!Number.isFinite(input.scrapQuantity) || input.scrapQuantity < 0)
      throw new Error("Scrap quantity must be a non-negative number.");
    if (input.quantityProduced === 0 && input.scrapQuantity === 0)
      throw new Error("Either produced or scrap quantity must be greater than 0.");

    // Validate materials have been issued in sufficient quantity
    const [{ data: bomItems }, { data: issues }, { data: existingPunches }] = await Promise.all([
      getClient()
        .from("bom_items")
        .select("component_item_id, quantity, scrap_percent")
        .eq("bom_id", wo.bomId),
      getClient()
        .from("production_issues")
        .select("item_id, issued_qty")
        .eq("work_order_id", input.workOrderId),
      getClient()
        .from("production_punches")
        .select("produced_qty, rejected_qty")
        .eq("work_order_id", input.workOrderId),
    ]);

    const issuedByItem: Record<string, number> = {};
    for (const i of issues ?? []) {
      const id = i.item_id as string;
      issuedByItem[id] = (issuedByItem[id] ?? 0) + Number(i.issued_qty ?? 0);
    }

    const alreadyProduced = (existingPunches ?? []).reduce(
      (sum, p) => sum + Number(p.produced_qty ?? 0) + Number(p.rejected_qty ?? 0),
      0,
    );

    if (bomItems && bomItems.length > 0) {
      let maxProducible = Infinity;
      const shortages: string[] = [];

      for (const b of bomItems) {
        const compId = b.component_item_id as string;
        const qtyPerUnit = Number(b.quantity);
        const scrapFactor = 1 + Number(b.scrap_percent ?? 0) / 100;
        const perUnit = qtyPerUnit * scrapFactor;
        const issued = issuedByItem[compId] ?? 0;

        if (issued === 0) {
          shortages.push(compId);
          maxProducible = 0;
        } else if (perUnit > 0) {
          maxProducible = Math.min(maxProducible, Math.floor(issued / perUnit));
        }
      }

      if (shortages.length > 0) {
        throw new Error(
          `Materials not issued yet. Issue required materials before punching production.`,
        );
      }

      const totalAfterPunch = alreadyProduced + input.quantityProduced + input.scrapQuantity;
      if (totalAfterPunch > maxProducible) {
        throw new Error(
          `Issued materials only support producing ${maxProducible} units. Already produced: ${alreadyProduced}. You are trying to punch ${input.quantityProduced + input.scrapQuantity} more, which exceeds available materials.`,
        );
      }
    }

    const { error: punchError } = await getClient()
      .from("production_punches")
      .insert({
        work_order_id: input.workOrderId,
        produced_qty: input.quantityProduced,
        rejected_qty: input.scrapQuantity,
        uom: "NOS",
        punched_by: actor?.id ?? null,
        punched_at: nowIso(),
      });
    assertNoError(punchError);

    // Recompute produced_qty on the work order from all punches
    const { data: totals } = await getClient()
      .from("production_punches")
      .select("produced_qty")
      .eq("work_order_id", input.workOrderId);
    const totalProduced = (totals ?? []).reduce(
      (sum, p) => sum + Number(p.produced_qty ?? 0),
      0,
    );
    await getClient()
      .from("work_orders")
      .update({ produced_qty: totalProduced })
      .eq("id", input.workOrderId);

    // Post INWARD stock_ledger entry for the finished good (positive quantity)
    const factoryId = wo.factory ? await getFactoryId(wo.factory) : null;
    if (input.quantityProduced > 0) {
      const { error: ledgerError } = await getClient()
        .from("stock_ledger")
        .insert({
          factory_id: factoryId,
          item_id: wo.finishedGoodItemId,
          transaction_type: "production_receipt",
          transaction_date: new Date().toISOString().slice(0, 10),
          quantity: input.quantityProduced,
          uom: "NOS",
          // TODO: compute running balance via DB function/trigger
          balance: input.quantityProduced,
          reference_type: "work_order",
          reference_id: input.workOrderId,
        });
      assertNoError(ledgerError);
    }
  },

  async completeWorkOrder(workOrderId) {
    const wo = await dbProductionService.getWorkOrderById(workOrderId);
    if (!wo) throw new Error("Work order not found.");
    if (wo.status === "COMPLETED") return wo;

    // Validate produced >= planned
    const { data: punches } = await getClient()
      .from("production_punches")
      .select("produced_qty")
      .eq("work_order_id", workOrderId);
    const totalProduced = (punches ?? []).reduce(
      (sum, p) => sum + Number(p.produced_qty ?? 0),
      0,
    );
    if (totalProduced + 1e-9 < wo.quantityPlanned)
      throw new Error(
        `Cannot complete: produced ${totalProduced} of ${wo.quantityPlanned} planned. Produce the remaining quantity first.`,
      );

    const { data, error } = await getClient()
      .from("work_orders")
      .update({ status: "completed", actual_end: nowIso() })
      .eq("id", workOrderId)
      .select()
      .single();
    assertNoError(error);
    if (!data) throw new Error("Work order not found.");
    const factoryCode = await getFactoryCode(data.factory_id as string);
    return toWorkOrder(data, factoryCode);
  },

  async getProductionIssues(workOrderId) {
    const [{ data: wo }, { data, error }] = await Promise.all([
      getClient()
        .from("work_orders")
        .select("factory_id")
        .eq("id", workOrderId)
        .single(),
      getClient()
        .from("production_issues")
        .select("id, work_order_id, item_id, issued_qty, created_at")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: true }),
    ]);
    assertNoError(error);
    const factoryCode = wo ? await getFactoryCode(wo.factory_id as string) : undefined;
    return (data ?? []).map((row) => toProductionIssue(row, factoryCode));
  },

  async getProductionPunches(workOrderId) {
    const [{ data: wo }, { data, error }] = await Promise.all([
      getClient()
        .from("work_orders")
        .select("factory_id")
        .eq("id", workOrderId)
        .single(),
      getClient()
        .from("production_punches")
        .select("id, work_order_id, produced_qty, rejected_qty, created_at")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: true }),
    ]);
    assertNoError(error);
    const factoryCode = wo ? await getFactoryCode(wo.factory_id as string) : undefined;
    return (data ?? []).map((row) => toProductionPunch(row, factoryCode));
  },
};
