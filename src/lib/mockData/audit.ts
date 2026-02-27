import type { AuditLogEntry, FactoryCode } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}_${uuid}`
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

let auditStore: AuditLogEntry[] = [
  {
    id: "al_0001",
    userId: "system",
    user: "Admin",
    action: "LOGIN",
    module: "Auth",
    factory: "YNM-PUNE",
    timestamp: "2026-02-18T08:30:00.000Z",
  },
  {
    id: "al_0002",
    userId: "system",
    user: "Admin",
    action: "APPROVE",
    module: "Purchase Requisition",
    entityId: "pr_001",
    entityType: "PR",
    details: { prNumber: "PR-2026-0001" },
    factory: "YNM-PUNE",
    timestamp: "2026-02-18T09:05:00.000Z",
  },
  {
    id: "al_0003",
    userId: "system",
    user: "Planning User",
    action: "CREATE",
    module: "Work Order",
    entityId: "wo_001",
    entityType: "WorkOrder",
    details: { woNumber: "WO-2026-0001", plannedQty: 500 },
    factory: "YNM-PUNE",
    timestamp: "2026-02-18T10:15:00.000Z",
  },
  {
    id: "al_0004",
    userId: "system",
    user: "Purchase User",
    action: "CREATE",
    module: "RFQ",
    entityId: "rfq_001",
    entityType: "RFQ",
    details: { rfqNumber: "RFQ-2026-0001", supplierCount: 3 },
    factory: "YNM-PUNE",
    timestamp: "2026-02-19T11:00:00.000Z",
  },
  {
    id: "al_0005",
    userId: "system",
    user: "Sales User",
    action: "CREATE",
    module: "Sales Order",
    entityId: "so_001",
    entityType: "SalesOrder",
    details: { soNumber: "SO-2026-0001", customerId: "cust_001" },
    factory: "YNM-CHENNAI",
    timestamp: "2026-02-20T14:30:00.000Z",
  },
  {
    id: "al_0006",
    userId: "system",
    user: "Stores User",
    action: "APPROVE",
    module: "GRN",
    entityId: "grn_001",
    entityType: "GRN",
    details: { grnNumber: "GRN-2026-0001", itemCount: 4 },
    factory: "YNM-PUNE",
    timestamp: "2026-02-20T16:00:00.000Z",
  },
  {
    id: "al_0007",
    userId: "system",
    user: "Admin",
    action: "UPDATE",
    module: "Items",
    entityId: "item_001",
    entityType: "Item",
    details: { updatedFields: ["itemName", "category"] },
    factory: "YNM-PUNE",
    timestamp: "2026-02-21T08:00:00.000Z",
  },
];

export async function logAudit(input: {
  userId?: string;
  user: string;
  action: string;
  module: string;
  entityId?: string;
  entityType?: string;
  details?: Record<string, unknown>;
  factory?: FactoryCode;
  timestamp?: string;
}): Promise<AuditLogEntry> {
  await sleep(30);
  const entry: AuditLogEntry = {
    id: genId("al"),
    userId: input.userId ?? "",
    user: input.user,
    action: input.action,
    module: input.module,
    entityId: input.entityId,
    entityType: input.entityType,
    details: input.details,
    factory: input.factory,
    timestamp: input.timestamp ?? nowIso(),
  };
  auditStore = [entry, ...auditStore];
  return entry;
}

export async function getAuditLogs(params?: {
  delayMs?: number;
  factory?: FactoryCode;
  module?: string;
  action?: string;
  userId?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  let list = [...auditStore];
  if (params?.factory) list = list.filter((e) => (e.factory ?? "YNM-PUNE") === params.factory);
  if (params?.module && params.module !== "ALL") list = list.filter((e) => e.module === params.module);
  if (params?.action) list = list.filter((e) => e.action === params.action);
  if (params?.userId) list = list.filter((e) => e.userId === params.userId);
  if (params?.limit) list = list.slice(0, params.limit);
  return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getAuditModules(): Promise<string[]> {
  await sleep(20);
  const set = new Set(auditStore.map((e) => e.module));
  return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
}
