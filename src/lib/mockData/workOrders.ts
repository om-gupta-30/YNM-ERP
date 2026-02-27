import type { WorkOrder } from "@/lib/types";

export const workOrders: WorkOrder[] = [
  {
    id: "wo_0101",
    woNumber: "WO-YNM-0101",
    finishedGoodItemId: "i_fg_gloves",
    bomId: "bom_001",
    quantityPlanned: 1200,
    status: "IN_PROGRESS",
    createdAt: "2025-02-01T10:00:00Z",
  },
  {
    id: "wo_0102",
    woNumber: "WO-YNM-0102",
    finishedGoodItemId: "i_sfg_shell",
    bomId: "bom_002",
    quantityPlanned: 800,
    status: "OPEN",
    createdAt: "2025-02-05T10:00:00Z",
  },
  {
    id: "wo_0103",
    woNumber: "WO-YNM-0103",
    finishedGoodItemId: "i_fg_gloves",
    bomId: "bom_001",
    quantityPlanned: 600,
    status: "COMPLETED",
    createdAt: "2025-01-20T10:00:00Z",
  },
];
