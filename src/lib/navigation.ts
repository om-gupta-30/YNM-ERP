import type { UserRole } from "@/lib/types";

export type NavSection = "setup" | "operations" | "admin";

export type NavItem = {
  label: string;
  href: string;
  description: string;
  icon: string;
  roles: UserRole[];
  section: NavSection;
  /** Step number within operations (1-10). Undefined for setup/admin items. */
  step?: number;
};

export const sidebarNav: NavItem[] = [
  // ── SETUP (master data — admin can view all, other roles manage their own) ──
  {
    label: "Items",
    href: "/masters/items",
    description: "Raw materials & finished goods",
    icon: "cube",
    roles: ["admin", "planning", "purchase", "stores"],
    section: "setup",
  },
  {
    label: "Suppliers",
    href: "/masters/suppliers",
    description: "Vendor master data",
    icon: "truck",
    roles: ["admin", "purchase"],
    section: "setup",
  },
  {
    label: "Customers",
    href: "/masters/customers",
    description: "Customer master data",
    icon: "users",
    roles: ["admin", "sales"],
    section: "setup",
  },
  {
    label: "Bill of Materials",
    href: "/masters/bom",
    description: "Component recipes for finished goods",
    icon: "clipboard",
    roles: ["admin", "planning", "production"],
    section: "setup",
  },

  {
    label: "Rate Master",
    href: "/masters/rate-card",
    description: "Supplier-item price list",
    icon: "tag",
    roles: ["admin", "purchase"],
    section: "setup",
  },

  // ── OPERATIONS (admin sees all for oversight, other roles see their steps) ──
  {
    label: "Price Finder",
    href: "/purchase/price-finder",
    description: "L1/L2/L3 supplier ranking for any item",
    icon: "search",
    roles: ["admin", "purchase", "planning"],
    section: "operations",
    step: 0,
  },
  {
    label: "Purchase Requisition",
    href: "/purchase/pr",
    description: "Request materials to buy",
    icon: "file-text",
    roles: ["admin", "planning", "purchase"],
    section: "operations",
    step: 1,
  },
  {
    label: "RFQ & Quotes",
    href: "/purchase/rfq",
    description: "Get prices from suppliers",
    icon: "mail",
    roles: ["admin", "purchase"],
    section: "operations",
    step: 2,
  },
  {
    label: "Purchase Orders",
    href: "/purchase/po",
    description: "Confirm the purchase",
    icon: "shopping-cart",
    roles: ["admin", "purchase"],
    section: "operations",
    step: 3,
  },
  {
    label: "Gate Entry",
    href: "/inventory/gate-entry",
    description: "Record goods arriving at gate",
    icon: "log-in",
    roles: ["admin", "security"],
    section: "operations",
    step: 4,
  },
  {
    label: "GRN",
    href: "/inventory/grn",
    description: "Inspect & accept received goods",
    icon: "check-square",
    roles: ["admin", "stores"],
    section: "operations",
    step: 5,
  },
  {
    label: "Work Orders",
    href: "/production/work-orders",
    description: "Plan production runs",
    icon: "settings",
    roles: ["admin", "planning", "production", "stores"],
    section: "operations",
    step: 6,
  },
  {
    label: "Production",
    href: "/production/dashboard",
    description: "Punch output & issue materials",
    icon: "activity",
    roles: ["admin", "production", "stores"],
    section: "operations",
    step: 7,
  },
  {
    label: "Sales Orders",
    href: "/sales/orders",
    description: "Customer orders",
    icon: "tag",
    roles: ["admin", "sales"],
    section: "operations",
    step: 8,
  },
  {
    label: "Dispatch",
    href: "/dispatch",
    description: "Ship goods to customers",
    icon: "package",
    roles: ["admin", "stores", "accounts"],
    section: "operations",
    step: 9,
  },
  {
    label: "Invoices",
    href: "/dispatch/invoices",
    description: "Bill the customer",
    icon: "file",
    roles: ["admin", "accounts"],
    section: "operations",
    step: 10,
  },

  // ── ADMIN (admin role only — approvals, stats, audit) ──
  {
    label: "Approvals",
    href: "/approvals",
    description: "Approve PRs, POs, GRNs",
    icon: "thumbs-up",
    roles: ["admin"],
    section: "admin",
  },
  {
    label: "Executive View",
    href: "/dashboard/director",
    description: "Cross-functional dashboard & stats",
    icon: "bar-chart",
    roles: ["admin"],
    section: "admin",
  },
  {
    label: "Stock & Ledger",
    href: "/inventory/stock",
    description: "View all inventory levels",
    icon: "database",
    roles: ["admin", "stores", "purchase"],
    section: "admin",
  },
  {
    label: "Audit Log",
    href: "/admin/audit",
    description: "Activity history",
    icon: "list",
    roles: ["admin"],
    section: "admin",
  },
];

export const sectionLabels: Record<NavSection, string> = {
  setup: "SETUP",
  operations: "OPERATIONS",
  admin: "ADMIN",
};

export function getNavBySection(role: UserRole | null) {
  if (!role) return { setup: [], operations: [], admin: [] };
  const filtered = sidebarNav.filter((i) => i.roles.includes(role));
  return {
    setup: filtered.filter((i) => i.section === "setup"),
    operations: filtered.filter((i) => i.section === "operations").sort((a, b) => (a.step ?? 0) - (b.step ?? 0)),
    admin: filtered.filter((i) => i.section === "admin"),
  };
}
