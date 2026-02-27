import { getClient } from "./_helpers";

export type DependencyHit = { type: string; count: number };

/**
 * Checks whether an item is referenced by active BOMs, open PRs, or active Work Orders.
 * Returns an array of dependency hits (only those with count > 0).
 */
export async function checkItemDependencies(itemId: string): Promise<DependencyHit[]> {
  const hits: DependencyHit[] = [];

  // Active BOM lines referencing this item
  const { count: bomCount } = await getClient()
    .from("bom_items")
    .select("id", { count: "exact", head: true })
    .eq("component_item_id", itemId)
    .not("bom_id", "is", null);

  if (bomCount && bomCount > 0) {
    // Narrow to only active BOMs
    const { data: activeBomItems } = await getClient()
      .from("bom_items")
      .select("bom_id")
      .eq("component_item_id", itemId);

    if (activeBomItems && activeBomItems.length > 0) {
      const bomIds = activeBomItems.map((r) => r.bom_id as string);
      const { count: activeCount } = await getClient()
        .from("bom_master")
        .select("id", { count: "exact", head: true })
        .in("id", bomIds)
        .eq("status", "active");
      if (activeCount && activeCount > 0) {
        hits.push({ type: "Active BOM", count: activeCount });
      }
    }
  }

  // Open PR lines
  const { data: prItems } = await getClient()
    .from("pr_items")
    .select("pr_id")
    .eq("item_id", itemId)
    .is("deleted_at", null);

  if (prItems && prItems.length > 0) {
    const prIds = [...new Set(prItems.map((r) => r.pr_id as string))];
    const { count: openPrCount } = await getClient()
      .from("purchase_requisitions")
      .select("id", { count: "exact", head: true })
      .in("id", prIds)
      .in("status", ["draft", "submitted"]);
    if (openPrCount && openPrCount > 0) {
      hits.push({ type: "Open Purchase Requisition", count: openPrCount });
    }
  }

  // Active Work Orders (item_id = finished good)
  const { count: woCount } = await getClient()
    .from("work_orders")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId)
    .in("status", ["open", "in_progress"]);
  if (woCount && woCount > 0) {
    hits.push({ type: "Active Work Order", count: woCount });
  }

  return hits;
}

/**
 * Checks whether a supplier is referenced by open RFQs or open POs.
 */
export async function checkSupplierDependencies(supplierId: string): Promise<DependencyHit[]> {
  const hits: DependencyHit[] = [];

  // Open RFQs
  const { data: rfqSups } = await getClient()
    .from("rfq_suppliers")
    .select("rfq_id")
    .eq("supplier_id", supplierId);

  if (rfqSups && rfqSups.length > 0) {
    const rfqIds = [...new Set(rfqSups.map((r) => r.rfq_id as string))];
    const { count: openRfqCount } = await getClient()
      .from("rfqs")
      .select("id", { count: "exact", head: true })
      .in("id", rfqIds)
      .in("status", ["draft", "sent"]);
    if (openRfqCount && openRfqCount > 0) {
      hits.push({ type: "Open RFQ", count: openRfqCount });
    }
  }

  // Open POs
  const { count: poCount } = await getClient()
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .in("status", ["open", "partial"]);
  if (poCount && poCount > 0) {
    hits.push({ type: "Open Purchase Order", count: poCount });
  }

  return hits;
}

/**
 * Checks whether a customer is referenced by open Sales Orders.
 */
export async function checkCustomerDependencies(customerId: string): Promise<DependencyHit[]> {
  const hits: DependencyHit[] = [];

  const { count: soCount } = await getClient()
    .from("sales_orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .in("status", ["open", "in_progress"]);
  if (soCount && soCount > 0) {
    hits.push({ type: "Open Sales Order", count: soCount });
  }

  return hits;
}

/**
 * Checks whether a BOM is used in active Work Orders.
 */
export async function checkBomDependencies(bomId: string): Promise<DependencyHit[]> {
  const hits: DependencyHit[] = [];

  const { count: woCount } = await getClient()
    .from("work_orders")
    .select("id", { count: "exact", head: true })
    .eq("bom_id", bomId)
    .in("status", ["open", "in_progress"]);
  if (woCount && woCount > 0) {
    hits.push({ type: "Active Work Order", count: woCount });
  }

  return hits;
}

/**
 * Formats dependency hits into a human-readable error message.
 */
export function formatDependencyError(entityName: string, hits: DependencyHit[]): string {
  const parts = hits.map((h) => `${h.count} ${h.type}${h.count > 1 ? "s" : ""}`);
  return `Cannot deactivate ${entityName}: referenced by ${parts.join(", ")}. Resolve these dependencies first.`;
}
