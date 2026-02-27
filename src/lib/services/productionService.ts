import type { FactoryCode, ProductionIssue, ProductionPunch, WorkOrder } from "@/lib/types";
import { dbProductionService } from "@/lib/dbServices/productionService";
import { logAudit } from "@/lib/auditLogger";

export type RequiredMaterialsResult = {
  workOrder: WorkOrder;
  required: Array<{
    itemId: string;
    requiredQty: number;
    scrapPercentage: number;
    quantityPerUnit: number;
  }>;
};

type Actor = { id: string; name: string; factory?: FactoryCode };

export type ProductionService = {
  getWorkOrders: (params?: { delayMs?: number; factory?: FactoryCode }) => Promise<WorkOrder[]>;
  getWorkOrderById: (workOrderId: string) => Promise<WorkOrder | null>;
  createWorkOrder: (input: {
    finishedGoodItemId: string;
    quantityPlanned: number;
    factory?: FactoryCode;
  }, actor?: Actor) => Promise<WorkOrder>;
  getRequiredMaterials: (workOrderId: string) => Promise<RequiredMaterialsResult>;
  issueMaterials: (input: {
    workOrderId: string;
    issues: Array<{ itemId: string; quantityIssued: number }>;
  }, actor?: Actor) => Promise<void>;
  punchProduction: (input: {
    workOrderId: string;
    quantityProduced: number;
    scrapQuantity: number;
  }, actor?: Actor) => Promise<void>;
  completeWorkOrder: (workOrderId: string, actor?: Actor) => Promise<WorkOrder>;
  getProductionIssues: (workOrderId: string) => Promise<ProductionIssue[]>;
  getProductionPunches: (workOrderId: string) => Promise<ProductionPunch[]>;
};

function audit(actor: Actor | undefined, action: string, module: string, entityId: string, entityType: string, details?: Record<string, unknown>) {
  if (!actor) return;
  logAudit({
    userId: actor.id,
    userName: actor.name,
    action: action as "CREATE",
    module: module as "Work Order",
    entityId,
    entityType,
    factory: actor.factory,
    details,
  });
}

export const productionService: ProductionService = {
  getWorkOrders:       (params)      => dbProductionService.getWorkOrders(params),
  getWorkOrderById:    (workOrderId) => dbProductionService.getWorkOrderById(workOrderId),
  getRequiredMaterials:(workOrderId) => dbProductionService.getRequiredMaterials(workOrderId),
  getProductionIssues: (workOrderId) => dbProductionService.getProductionIssues(workOrderId),
  getProductionPunches:(workOrderId) => dbProductionService.getProductionPunches(workOrderId),

  async createWorkOrder(input, actor) {
    const wo = await dbProductionService.createWorkOrder(input, actor);
    audit(actor, "CREATE", "Work Order", wo.id, "WorkOrder", { woNumber: wo.woNumber, plannedQty: input.quantityPlanned });
    return wo;
  },

  async issueMaterials(input, actor) {
    await dbProductionService.issueMaterials(input, actor);
    audit(actor, "CREATE", "Production", input.workOrderId, "ProductionIssue", { issueCount: input.issues.length });
  },

  async punchProduction(input, actor) {
    await dbProductionService.punchProduction(input, actor);
    audit(actor, "CREATE", "Production", input.workOrderId, "ProductionPunch", {
      quantityProduced: input.quantityProduced,
      scrapQuantity: input.scrapQuantity,
    });
  },

  async completeWorkOrder(workOrderId, actor) {
    const wo = await dbProductionService.completeWorkOrder(workOrderId);
    audit(actor, "STATUS_CHANGE", "Work Order", workOrderId, "WorkOrder", { woNumber: wo.woNumber, newStatus: wo.status });
    return wo;
  },
};
