export type UserRole =
  | "admin"
  | "planning"
  | "purchase"
  | "sales"
  | "accounts"
  | "security"
  | "stores"
  | "production";

export type FactoryCode = "YNM-HYD" | "YNM-PUNE" | "YNM-CHENNAI";

export type User = {
  id: string;
  name: string;
  username?: string;
  email: string;
  password: string;
  role: UserRole;
  factory: FactoryCode;
  isActive: boolean;
};

export type ItemType =
  | "RAW_MATERIAL"
  | "SEMI_FINISHED"
  | "FINISHED_GOOD"
  | "TRADING";

export type Item = {
  id: string;
  itemCode: string;
  itemName: string;
  itemType: ItemType;
  category: string;
  uom: "NOS" | "KG" | "MTR";
  hsnCode: string;
  reorderLevel: number;
  isBomApplicable: boolean;
  isActive: boolean;
  createdAt: string; // ISO timestamp
};

export type Supplier = {
  id: string;
  supplierCode: string;
  supplierName: string;
  gstNumber: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  paymentTerms: string;
  isActive: boolean;
  createdAt: string; // ISO timestamp
};

export type Customer = {
  id: string;
  customerCode: string;
  customerName: string;
  gstNumber: string;
  billingAddress: string;
  shippingAddress: string;
  contactPerson: string;
  phone: string;
  email: string;
  creditTerms: string;
  isActive: boolean;
  createdAt: string; // ISO timestamp
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierId: string;
  linkedRfqId: string;
  status: "OPEN" | "APPROVED" | "PARTIAL" | "CLOSED";
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type PurchaseRequisitionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED";

export type PurchaseRequisition = {
  id: string;
  prNumber: string;
  requestedBy: string;
  department: string;
  status: PurchaseRequisitionStatus;
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type PurchaseRequisitionItem = {
  id: string;
  prId: string;
  itemId: string;
  quantity: number;
  remarks: string;
};

export type PurchaseRequisitionStatusEvent = {
  id: string;
  prId: string;
  status: PurchaseRequisitionStatus;
  at: string; // ISO timestamp
  by: string;
  note?: string;
};

export type RFQStatus = "DRAFT" | "SENT" | "QUOTED" | "CLOSED";

export type RFQ = {
  id: string;
  rfqNumber: string;
  linkedPrId: string;
  selectedSuppliers: string[];
  status: RFQStatus;
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type ItemQuote = {
  itemId: string;
  unitPrice: number;
  taxPercent: number;
  deliveryDays: number;
};

export type SupplierQuote = {
  id: string;
  rfqId: string;
  supplierId: string;
  itemQuotes: ItemQuote[];
};

export type GateEntry = {
  id: string;
  gateEntryNumber: string;
  poId: string;
  supplierId: string;
  vehicleNumber: string;
  invoiceNumber: string;
  ewayBillNumber: string;
  status: "OPEN" | "CLOSED";
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type GRN = {
  id: string;
  grnNumber: string;
  gateEntryId: string;
  poId: string;
  status: "DRAFT" | "APPROVED" | "PARTIAL" | "REJECTED";
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type GRNItem = {
  id: string;
  grnId: string;
  itemId: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
};

export type StockLedger = {
  id: string;
  itemId: string;
  transactionType: "INWARD" | "OUTWARD";
  quantity: number;
  referenceType: "GRN" | "PRODUCTION" | "DISPATCH";
  referenceId: string;
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type WorkOrder = {
  id: string;
  woNumber: string;
  finishedGoodItemId: string;
  bomId: string;
  quantityPlanned: number;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type ProductionIssue = {
  id: string;
  workOrderId: string;
  itemId: string;
  quantityIssued: number;
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type ProductionPunch = {
  id: string;
  workOrderId: string;
  quantityProduced: number;
  scrapQuantity: number;
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type SalesOrder = {
  id: string;
  soNumber: string;
  customerId: string;
  orderDate: string; // ISO date
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type SalesOrderItem = {
  id: string;
  soId: string;
  itemId: string;
  quantity: number;
  rate: number;
};

export type Dispatch = {
  id: string;
  dispatchNumber: string;
  soId: string;
  dispatchDate: string; // ISO date
  status: "PENDING" | "DISPATCHED";
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type DispatchItem = {
  id: string;
  dispatchId: string;
  itemId: string;
  quantityDispatched: number;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  dispatchId: string;
  totalAmount: number;
  taxAmount: number;
  factory?: FactoryCode;
  createdAt: string; // ISO timestamp
};

export type Notification = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  href?: string;
  createdAt: string; // ISO timestamp
  factory?: FactoryCode;
};

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "SUBMIT"
  | "STATUS_CHANGE"
  | "LOGIN"
  | "LOGOUT";

export type AuditModule =
  | "Auth"
  | "Items"
  | "Suppliers"
  | "Customers"
  | "BOM"
  | "Purchase Requisition"
  | "RFQ"
  | "Purchase Order"
  | "Gate Entry"
  | "GRN"
  | "Stock Ledger"
  | "Work Order"
  | "Production"
  | "Sales Order"
  | "Dispatch"
  | "Invoice"
  | "Admin";

export type AuditLogEntry = {
  id: string;
  userId: string;
  user: string;
  action: AuditAction | string;
  module: AuditModule | string;
  entityId?: string;
  entityType?: string;
  details?: Record<string, unknown>;
  factory?: FactoryCode;
  timestamp: string;
};

export type BOM = {
  id: string;
  bomCode: string;
  finishedGoodItemId: string;
  version: number;
  isActive: boolean;
  createdAt: string; // ISO timestamp
};

export type BOMItem = {
  id: string;
  bomId: string;
  rawMaterialItemId: string;
  quantityPerUnit: number;
  scrapPercentage: number;
};

export type GetItemsParams = { delayMs?: number };
export type GetSuppliersParams = { delayMs?: number };
export type GetCustomersParams = { delayMs?: number };

