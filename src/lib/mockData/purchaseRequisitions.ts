import type {
  FactoryCode,
  PurchaseRequisition,
  PurchaseRequisitionItem,
  PurchaseRequisitionStatus,
  PurchaseRequisitionStatusEvent,
} from "@/lib/types";
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

function nextPrNumber(existing: PurchaseRequisition[]) {
  const nums = existing
    .map((p) => {
      const m = p.prNumber.match(/PR-YNM-(\d+)/);
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `PR-YNM-${String(next).padStart(4, "0")}`;
}

let prsStore: PurchaseRequisition[] = [
  {
    id: "pr_0007",
    prNumber: "PR-YNM-0007",
    requestedBy: "Planning User",
    department: "Planning",
    status: "SUBMITTED",
    factory: "YNM-PUNE",
    createdAt: "2026-02-10T09:00:00.000Z",
  },
  {
    id: "pr_0008",
    prNumber: "PR-YNM-0008",
    requestedBy: "Purchase User",
    department: "Purchase",
    status: "SUBMITTED",
    factory: "YNM-CHENNAI",
    createdAt: "2026-02-12T10:30:00.000Z",
  },
  {
    id: "pr_0009",
    prNumber: "PR-YNM-0009",
    requestedBy: "Planning User",
    department: "Planning",
    status: "DRAFT",
    factory: "YNM-PUNE",
    createdAt: "2026-02-14T14:15:00.000Z",
  },
  {
    id: "pr_0010",
    prNumber: "PR-YNM-0010",
    requestedBy: "Planning User",
    department: "Planning",
    status: "APPROVED",
    factory: "YNM-PUNE",
    createdAt: "2026-02-15T11:00:00.000Z",
  },
];

let prItemsStore: PurchaseRequisitionItem[] = [
  {
    id: "pri_0001",
    prId: "pr_0007",
    itemId: "i_rm_abs_granules",
    quantity: 250,
    remarks: "For next production batch",
  },
  {
    id: "pri_0002",
    prId: "pr_0007",
    itemId: "i_rm_steel_rod",
    quantity: 120,
    remarks: "",
  },
  {
    id: "pri_0003",
    prId: "pr_0009",
    itemId: "i_pm_box_small",
    quantity: 500,
    remarks: "Urgent packaging requirement",
  },
  {
    id: "pri_0004",
    prId: "pr_0010",
    itemId: "i_rm_abs_granules",
    quantity: 400,
    remarks: "",
  },
];

let prEventsStore: PurchaseRequisitionStatusEvent[] = [
  {
    id: "pre_0001",
    prId: "pr_0007",
    status: "DRAFT",
    at: "2026-02-10T09:00:00.000Z",
    by: "Planning User",
  },
  {
    id: "pre_0002",
    prId: "pr_0007",
    status: "SUBMITTED",
    at: "2026-02-10T11:00:00.000Z",
    by: "Planning User",
  },
  {
    id: "pre_0003",
    prId: "pr_0010",
    status: "DRAFT",
    at: "2026-02-15T11:00:00.000Z",
    by: "Planning User",
  },
  {
    id: "pre_0004",
    prId: "pr_0010",
    status: "SUBMITTED",
    at: "2026-02-15T12:30:00.000Z",
    by: "Planning User",
  },
  {
    id: "pre_0005",
    prId: "pr_0010",
    status: "APPROVED",
    at: "2026-02-15T16:20:00.000Z",
    by: "Admin",
  },
];

export async function getPRs(params?: { delayMs?: number; factory?: FactoryCode }): Promise<PurchaseRequisition[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  const list = params?.factory
    ? prsStore.filter((p) => (p.factory ?? "YNM-PUNE") === params.factory)
    : prsStore;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPRById(prId: string): Promise<PurchaseRequisition | null> {
  await sleep(120);
  return prsStore.find((p) => p.id === prId) ?? null;
}

export async function getPRItems(prId: string): Promise<PurchaseRequisitionItem[]> {
  await sleep(120);
  return prItemsStore.filter((i) => i.prId === prId);
}

export async function getPRHistory(prId: string): Promise<PurchaseRequisitionStatusEvent[]> {
  await sleep(120);
  return prEventsStore
    .filter((e) => e.prId === prId)
    .sort((a, b) => a.at.localeCompare(b.at));
}

function setStatus(prId: string, status: PurchaseRequisitionStatus, by: string, note?: string) {
  prsStore = prsStore.map((p) => (p.id === prId ? { ...p, status } : p));
  prEventsStore = [
    ...prEventsStore,
    { id: genId("pre"), prId, status, at: nowIso(), by, note },
  ];
}

function ensureUniqueItems(items: Array<{ itemId: string }>) {
  const ids = items.map((i) => i.itemId).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate items are not allowed.");
}

export async function createPR(input: {
  requestedBy: string;
  department: string;
  items: Array<{ itemId: string; quantity: number; remarks: string }>;
  factory?: FactoryCode;
}): Promise<PurchaseRequisition> {
  await sleep(450);
  if (!input.requestedBy.trim()) throw new Error("Requested by is required.");
  if (!input.department.trim()) throw new Error("Department is required.");
  if (!input.items.length) throw new Error("At least one item is required.");
  ensureUniqueItems(input.items);

  for (const it of input.items) {
    if (!it.itemId) throw new Error("Item is required.");
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) throw new Error("Quantity must be > 0.");
  }

  const pr: PurchaseRequisition = {
    id: genId("pr"),
    prNumber: nextPrNumber(prsStore),
    requestedBy: input.requestedBy.trim(),
    department: input.department.trim(),
    status: "DRAFT",
    factory: input.factory ?? "YNM-PUNE",
    createdAt: nowIso(),
  };

  const prItems: PurchaseRequisitionItem[] = input.items.map((i) => ({
    id: genId("pri"),
    prId: pr.id,
    itemId: i.itemId,
    quantity: Number(i.quantity),
    remarks: i.remarks?.trim() ?? "",
  }));

  prsStore = [pr, ...prsStore];
  prItemsStore = [...prItems, ...prItemsStore];
  prEventsStore = [
    ...prEventsStore,
    { id: genId("pre"), prId: pr.id, status: "DRAFT", at: pr.createdAt, by: pr.requestedBy },
  ];

  await logAudit({
    user: pr.requestedBy,
    action: "CREATE_PR",
    module: "Purchase Requisition",
    factory: pr.factory,
    timestamp: pr.createdAt,
  });
  return pr;
}

export async function updatePR(input: {
  prId: string;
  department: string;
  items: Array<{ itemId: string; quantity: number; remarks: string }>;
}): Promise<PurchaseRequisition> {
  await sleep(450);
  const pr = prsStore.find((p) => p.id === input.prId);
  if (!pr) throw new Error("PR not found.");
  if (pr.status !== "DRAFT") throw new Error("Only draft PRs can be edited.");
  if (!input.department.trim()) throw new Error("Department is required.");
  if (!input.items.length) throw new Error("At least one item is required.");
  ensureUniqueItems(input.items);

  for (const it of input.items) {
    if (!it.itemId) throw new Error("Item is required.");
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) throw new Error("Quantity must be > 0.");
  }

  prsStore = prsStore.map((p) =>
    p.id === input.prId ? { ...p, department: input.department.trim() } : p,
  );
  prItemsStore = prItemsStore.filter((i) => i.prId !== input.prId);
  prItemsStore = [
    ...input.items.map((i) => ({
      id: genId("pri"),
      prId: input.prId,
      itemId: i.itemId,
      quantity: Number(i.quantity),
      remarks: i.remarks?.trim() ?? "",
    })),
    ...prItemsStore,
  ];

  const next = prsStore.find((p) => p.id === input.prId)!;
  await logAudit({
    user: next.requestedBy,
    action: "UPDATE_PR",
    module: "Purchase Requisition",
    factory: next.factory,
  });
  return next;
}

export async function submitPR(input: { prId: string; by: string }): Promise<PurchaseRequisition> {
  await sleep(350);
  const pr = prsStore.find((p) => p.id === input.prId);
  if (!pr) throw new Error("PR not found.");
  if (pr.status !== "DRAFT") throw new Error("Only draft PRs can be submitted.");

  const items = prItemsStore.filter((i) => i.prId === pr.id);
  if (items.length === 0) throw new Error("PR must contain at least one item.");

  setStatus(pr.id, "SUBMITTED", input.by);
  await logAudit({
    user: input.by,
    action: "SUBMIT_PR",
    module: "Purchase Requisition",
    factory: pr.factory,
  });
  return prsStore.find((p) => p.id === pr.id)!;
}

export async function approvePR(input: { prId: string; by: string; note?: string }): Promise<PurchaseRequisition> {
  await sleep(350);
  const pr = prsStore.find((p) => p.id === input.prId);
  if (!pr) throw new Error("PR not found.");
  if (pr.status !== "SUBMITTED") throw new Error("Only submitted PRs can be approved.");

  setStatus(pr.id, "APPROVED", input.by, input.note);
  await logAudit({
    user: input.by,
    action: "APPROVE_PR",
    module: "Purchase Requisition",
    factory: pr.factory,
  });
  return prsStore.find((p) => p.id === pr.id)!;
}

export async function rejectPR(input: { prId: string; by: string; note?: string }): Promise<PurchaseRequisition> {
  await sleep(350);
  const pr = prsStore.find((p) => p.id === input.prId);
  if (!pr) throw new Error("PR not found.");
  if (pr.status !== "SUBMITTED") throw new Error("Only submitted PRs can be rejected.");

  setStatus(pr.id, "REJECTED", input.by, input.note);
  await logAudit({
    user: input.by,
    action: "REJECT_PR",
    module: "Purchase Requisition",
    factory: pr.factory,
  });
  return prsStore.find((p) => p.id === pr.id)!;
}

