import type { FactoryCode } from "@/lib/types";
import { itemService } from "@/lib/services/itemService";
import { prService } from "@/lib/services/prService";
import { productionService } from "@/lib/services/productionService";

export type DashboardKpis = {
  inventoryItemCount: number;
  pendingPurchaseRequisitions: number;
  activeWorkOrders: number;
};

export const dashboardService = {
  async getKpis(params?: { factory?: FactoryCode }): Promise<DashboardKpis> {
    const items = await itemService.getItems();
    const prs = await prService.getPRs({ factory: params?.factory });
    const pendingPurchaseRequisitions = prs.filter((pr) => pr.status === "SUBMITTED").length;
    const wos = await productionService.getWorkOrders({ factory: params?.factory });
    const activeWorkOrders = wos.filter(
      (wo) => wo.status === "OPEN" || wo.status === "IN_PROGRESS",
    ).length;

    return {
      inventoryItemCount: items.length,
      pendingPurchaseRequisitions,
      activeWorkOrders,
    };
  },
};

