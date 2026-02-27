import type { FactoryCode, Notification, UserRole } from "@/lib/types";
import { inventoryService } from "@/lib/services/inventoryService";
import { itemService } from "@/lib/services/itemService";
import { prService } from "@/lib/services/prService";
import { productionService } from "@/lib/services/productionService";

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  // Logic correction: safer IDs to avoid collisions in notification list rendering.
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}_${uuid}`
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function canSee(severity: Notification["severity"], role: UserRole) {
  if (role === "admin") return true;
  if (severity === "critical") return role === "stores" || role === "purchase" || role === "production";
  return true;
}

export const notificationService = {
  async getNotifications(params: { role: UserRole; factory: FactoryCode }): Promise<Notification[]> {
    const [items, prs, wos, stock] = await Promise.all([
      itemService.getItems(),
      prService.getPRs({ factory: params.factory }),
      productionService.getWorkOrders({ factory: params.factory }),
      inventoryService.getCurrentStock({ factory: params.factory }),
    ]);

    const out: Notification[] = [];

    // PR pending approvals
    const pendingPr = prs.filter((p) => p.status === "SUBMITTED");
    if (pendingPr.length) {
      out.push({
        id: genId("ntf"),
        title: "PR pending approval",
        message: `${pendingPr.length} purchase requisition(s) awaiting approval.`,
        severity: "warning",
        href: "/approvals",
        createdAt: nowIso(),
        factory: params.factory,
      });
    }

    // Low stock alerts (items with reorderLevel > 0 and stock <= reorderLevel)
    const low = items
      .filter((i) => i.isActive && i.reorderLevel > 0)
      .map((i) => ({ item: i, onHand: stock[i.id] ?? 0 }))
      .filter((x) => x.onHand <= x.item.reorderLevel)
      .sort((a, b) => (a.onHand - a.item.reorderLevel) - (b.onHand - b.item.reorderLevel))
      .slice(0, 5);

    if (low.length) {
      out.push({
        id: genId("ntf"),
        title: "Low stock alerts",
        message: `${low.length} item(s) at/below reorder level. Top: ${low[0]?.item.itemCode} (${low[0]?.onHand}).`,
        severity: low.some((x) => x.onHand <= 0) ? "critical" : "warning",
        href: "/inventory/stock",
        createdAt: nowIso(),
        factory: params.factory,
      });
    }

    // Work order status alerts
    const open = wos.filter((w) => w.status === "OPEN").length;
    const inProg = wos.filter((w) => w.status === "IN_PROGRESS").length;
    if (open + inProg) {
      out.push({
        id: genId("ntf"),
        title: "Work orders in progress",
        message: `${open} open, ${inProg} in progress work order(s).`,
        severity: "info",
        href: "/production/dashboard",
        createdAt: nowIso(),
        factory: params.factory,
      });
    }

    return out
      .filter((n) => canSee(n.severity, params.role))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};

