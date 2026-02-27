import type { PurchaseOrder } from "@/lib/types";

export const purchaseOrders: PurchaseOrder[] = [
  {
    id: "po_0001",
    poNumber: "PO-YNM-0001",
    supplierId: "s_ambit",
    linkedRfqId: "rfq_0001",
    status: "OPEN",
    createdAt: "2026-02-17T12:15:00.000Z",
  },
  {
    id: "po_0002",
    poNumber: "PO-YNM-0002",
    supplierId: "s_polychem",
    linkedRfqId: "rfq_0001",
    status: "PARTIAL",
    createdAt: "2026-02-18T09:00:00.000Z",
  },
  {
    id: "po_0003",
    poNumber: "PO-YNM-0003",
    supplierId: "s_packco",
    linkedRfqId: "rfq_0001",
    status: "CLOSED",
    createdAt: "2026-02-18T10:30:00.000Z",
  },
];

