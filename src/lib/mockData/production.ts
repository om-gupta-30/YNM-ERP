import type { BOMItem, FactoryCode, ProductionIssue, ProductionPunch, WorkOrder } from "@/lib/types";
import { getActiveBOMForFinishedGood, getBOMItems } from "@/lib/mockData/boms";
import { getCurrentStock, postStockLedgerEntries } from "@/lib/mockData/inventory";
import { logAudit } from "@/lib/mockData/audit";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  // Logic correction: safer IDs to avoid collisions in mock store.
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}_${uuid}`
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nextWoNumber(existing: WorkOrder[]) {
  const nums = existing
    .map((w) => {
      const m = w.woNumber.match(/WO-YNM-(\d+)/);
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 100) + 1;
  return `WO-YNM-${String(next).padStart(4, "0")}`;
}

function requiredForLine(line: BOMItem, plannedQty: number) {
  const base = line.quantityPerUnit * plannedQty;
  const scrapFactor = 1 + line.scrapPercentage / 100;
  return Number((base * scrapFactor).toFixed(6));
}

let workOrdersStore: WorkOrder[] = [
  {
    id: "wo_0201",
    woNumber: "WO-YNM-0201",
    finishedGoodItemId: "i_fg_gloves",
    bomId: "bom_001",
    quantityPlanned: 1000,
    status: "IN_PROGRESS",
    factory: "YNM-PUNE",
    createdAt: "2026-02-18T08:00:00.000Z",
  },
  {
    id: "wo_0202",
    woNumber: "WO-YNM-0202",
    finishedGoodItemId: "i_fg_gloves",
    bomId: "bom_001",
    quantityPlanned: 600,
    status: "OPEN",
    factory: "YNM-CHENNAI",
    createdAt: "2026-02-18T10:00:00.000Z",
  },
];

let issuesStore: ProductionIssue[] = [
  {
    id: "pi_0001",
    workOrderId: "wo_0201",
    itemId: "i_rm_abs_granules",
    quantityIssued: 110,
    factory: "YNM-PUNE",
    createdAt: "2026-02-18T09:00:00.000Z",
  },
];

let punchesStore: ProductionPunch[] = [
  {
    id: "pp_0001",
    workOrderId: "wo_0201",
    quantityProduced: 250,
    scrapQuantity: 5,
    factory: "YNM-PUNE",
    createdAt: "2026-02-18T12:00:00.000Z",
  },
];

export async function getWorkOrders(params?: { delayMs?: number; factory?: FactoryCode }): Promise<WorkOrder[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  const list = params?.factory
    ? workOrdersStore.filter((w) => (w.factory ?? "YNM-PUNE") === params.factory)
    : workOrdersStore;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getWorkOrderById(workOrderId: string): Promise<WorkOrder | null> {
  await sleep(120);
  return workOrdersStore.find((w) => w.id === workOrderId) ?? null;
}

export async function getProductionIssues(workOrderId: string): Promise<ProductionIssue[]> {
  await sleep(120);
  return issuesStore
    .filter((i) => i.workOrderId === workOrderId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getProductionPunches(workOrderId: string): Promise<ProductionPunch[]> {
  await sleep(120);
  return punchesStore
    .filter((p) => p.workOrderId === workOrderId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createWorkOrder(input: {
  finishedGoodItemId: string;
  quantityPlanned: number;
  factory?: FactoryCode;
}): Promise<WorkOrder> {
  await sleep(450);
  if (!input.finishedGoodItemId) throw new Error("Finished good is required.");
  if (!Number.isFinite(input.quantityPlanned) || input.quantityPlanned <= 0) {
    throw new Error("Planned quantity must be > 0.");
  }

  const bom = await getActiveBOMForFinishedGood(input.finishedGoodItemId);
  if (!bom) throw new Error("No active BOM found for selected finished good.");

  const wo: WorkOrder = {
    id: genId("wo"),
    woNumber: nextWoNumber(workOrdersStore),
    finishedGoodItemId: input.finishedGoodItemId,
    bomId: bom.id,
    quantityPlanned: Number(input.quantityPlanned),
    status: "OPEN",
    factory: input.factory ?? "YNM-PUNE",
    createdAt: nowIso(),
  };
  workOrdersStore = [wo, ...workOrdersStore];
  await logAudit({
    user: "Planning",
    action: "CREATE_WORK_ORDER",
    module: "Production",
    factory: wo.factory,
    timestamp: wo.createdAt,
  });
  return wo;
}

export async function getRequiredMaterials(workOrderId: string) {
  const wo = await getWorkOrderById(workOrderId);
  if (!wo) throw new Error("Work order not found.");
  const bomItems = await getBOMItems(wo.bomId);
  const required = bomItems.map((b) => ({
    itemId: b.rawMaterialItemId,
    requiredQty: requiredForLine(b, wo.quantityPlanned),
    scrapPercentage: b.scrapPercentage,
    quantityPerUnit: b.quantityPerUnit,
  }));
  return { workOrder: wo, required };
}

export async function issueMaterials(input: {
  workOrderId: string;
  issues: Array<{ itemId: string; quantityIssued: number }>;
}): Promise<void> {
  await sleep(500);
  const wo = await getWorkOrderById(input.workOrderId);
  if (!wo) throw new Error("Work order not found.");
  if (wo.status === "COMPLETED") throw new Error("Cannot issue materials to a completed work order.");

  const { required } = await getRequiredMaterials(wo.id);
  const requiredByItem = new Map(required.map((r) => [r.itemId, r.requiredQty]));

  const ids = input.issues.map((i) => i.itemId).filter(Boolean);
  if (!ids.length) throw new Error("No issue lines provided.");
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate issue items are not allowed.");

  const issuedSoFar = issuesStore
    .filter((i) => i.workOrderId === wo.id)
    .reduce<Record<string, number>>((acc, i) => {
      acc[i.itemId] = (acc[i.itemId] ?? 0) + i.quantityIssued;
      return acc;
    }, {});

  const stock = await getCurrentStock({ factory: wo.factory ?? "YNM-PUNE" });

  for (const line of input.issues) {
    const req = requiredByItem.get(line.itemId);
    if (req == null) throw new Error("Item is not part of BOM requirement.");
    if (!Number.isFinite(line.quantityIssued) || line.quantityIssued <= 0) {
      throw new Error("Issued quantity must be > 0.");
    }
    const nextIssuedTotal = (issuedSoFar[line.itemId] ?? 0) + Number(line.quantityIssued);
    if (nextIssuedTotal - req > 1e-9) {
      throw new Error("Issued quantity exceeds required quantity.");
    }
    const available = stock[line.itemId] ?? 0;
    if (Number(line.quantityIssued) - available > 1e-9) {
      throw new Error("Insufficient stock for one or more items.");
    }
  }

  const at = nowIso();
  const issueEntries: ProductionIssue[] = input.issues.map((l) => ({
    id: genId("pi"),
    workOrderId: wo.id,
    itemId: l.itemId,
    quantityIssued: Number(l.quantityIssued),
    factory: wo.factory,
    createdAt: at,
  }));
  issuesStore = [...issueEntries, ...issuesStore];

  await postStockLedgerEntries(
    issueEntries.map((i) => ({
      itemId: i.itemId,
      transactionType: "OUTWARD",
      quantity: i.quantityIssued,
      referenceType: "PRODUCTION",
      referenceId: wo.id,
      createdAt: i.createdAt,
      factory: wo.factory,
    })),
  );

  if (wo.status === "OPEN") {
    workOrdersStore = workOrdersStore.map((w) =>
      w.id === wo.id ? { ...w, status: "IN_PROGRESS" } : w,
    );
  }

  await logAudit({
    user: "Stores",
    action: "ISSUE_MATERIALS",
    module: "Production",
    factory: wo.factory,
  });
}

export async function punchProduction(input: {
  workOrderId: string;
  quantityProduced: number;
  scrapQuantity: number;
}): Promise<void> {
  await sleep(450);
  const wo = await getWorkOrderById(input.workOrderId);
  if (!wo) throw new Error("Work order not found.");
  if (wo.status === "COMPLETED") throw new Error("Work order is already completed.");

  const produced = Number(input.quantityProduced);
  const scrap = Number(input.scrapQuantity);
  if ((!Number.isFinite(produced) || produced < 0) || (!Number.isFinite(scrap) || scrap < 0)) {
    throw new Error("Produced and scrap quantities must be non-negative.");
  }
  if (produced === 0 && scrap === 0) throw new Error("Enter produced or scrap quantity.");

  const at = nowIso();
  const punch: ProductionPunch = {
    id: genId("pp"),
    workOrderId: wo.id,
    quantityProduced: produced,
    scrapQuantity: scrap,
    factory: wo.factory,
    createdAt: at,
  };
  punchesStore = [punch, ...punchesStore];

  if (produced > 0) {
    await postStockLedgerEntries([
      {
        itemId: wo.finishedGoodItemId,
        transactionType: "INWARD",
        quantity: produced,
        referenceType: "PRODUCTION",
        referenceId: wo.id,
        createdAt: at,
        factory: wo.factory,
      },
    ]);
  }

  if (wo.status === "OPEN") {
    workOrdersStore = workOrdersStore.map((w) =>
      w.id === wo.id ? { ...w, status: "IN_PROGRESS" } : w,
    );
  }

  await logAudit({
    user: "Production",
    action: "PUNCH_PRODUCTION",
    module: "Production",
    factory: wo.factory,
  });
}

export async function completeWorkOrder(workOrderId: string): Promise<WorkOrder> {
  await sleep(300);
  const wo = await getWorkOrderById(workOrderId);
  if (!wo) throw new Error("Work order not found.");
  if (wo.status === "COMPLETED") return wo;

  const totalProduced = punchesStore
    .filter((p) => p.workOrderId === wo.id)
    .reduce((s, p) => s + p.quantityProduced, 0);
  if (totalProduced + 1e-9 < wo.quantityPlanned) {
    throw new Error("Cannot complete work order until planned quantity is produced.");
  }

  const next: WorkOrder = { ...wo, status: "COMPLETED" };
  workOrdersStore = workOrdersStore.map((w) => (w.id === wo.id ? next : w));
  await logAudit({
    user: "Production",
    action: "COMPLETE_WORK_ORDER",
    module: "Production",
    factory: next.factory,
  });
  return next;
}

