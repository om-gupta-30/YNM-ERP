/**
 * rbac.ts — single source of truth for all ERP role-based access control.
 *
 * Rules:
 *  • admin — view-only access across all modules + approval power.
 *            Admin does NOT create, edit, or operate — only approves and views.
 *  • All other roles have module-scoped permissions as defined below.
 */

import type { UserRole } from "@/lib/types";

type Role = UserRole | null;

function has(role: Role, ...allowed: UserRole[]): boolean {
  return role !== null && (allowed as string[]).includes(role);
}

export const can = {
  // ── Item Master ────────────────────────────────────────────────────────
  viewItems:     (r: Role) => has(r, "admin", "planning", "purchase", "stores"),
  editItems:     (r: Role) => has(r, "purchase"),

  // ── Supplier Master ───────────────────────────────────────────────────
  viewSuppliers: (r: Role) => has(r, "admin", "purchase"),
  editSuppliers: (r: Role) => has(r, "purchase"),

  // ── Customer Master ───────────────────────────────────────────────────
  viewCustomers: (r: Role) => has(r, "admin", "sales"),
  editCustomers: (r: Role) => has(r, "sales"),

  // ── BOM Master ────────────────────────────────────────────────────────
  viewBOM:       (r: Role) => has(r, "admin", "planning", "production"),
  editBOM:       (r: Role) => has(r, "production"),

  // ── Rate Master (Supplier-Item Prices) ───────────────────────────────
  viewRateMaster: (r: Role) => has(r, "admin", "purchase"),
  editRateMaster: (r: Role) => has(r, "purchase"),

  // ── Purchase Requisition ──────────────────────────────────────────────
  viewPR:        (r: Role) => has(r, "admin", "planning", "purchase"),
  createPR:      (r: Role) => has(r, "planning"),
  submitPR:      (r: Role) => has(r, "planning"),
  approvePR:     (r: Role) => has(r, "admin"),

  // ── RFQ ───────────────────────────────────────────────────────────────
  viewRFQ:       (r: Role) => has(r, "admin", "purchase"),
  editRFQ:       (r: Role) => has(r, "purchase"),
  sendRFQ:       (r: Role) => has(r, "purchase"),
  addQuote:      (r: Role) => has(r, "purchase"),

  // ── Purchase Order ────────────────────────────────────────────────────
  viewPO:        (r: Role) => has(r, "admin", "purchase"),
  generatePO:    (r: Role) => has(r, "purchase"),
  approvePO:     (r: Role) => has(r, "admin"),

  // ── Gate Entry ────────────────────────────────────────────────────────
  viewGateEntry:   (r: Role) => has(r, "admin", "security"),
  createGateEntry: (r: Role) => has(r, "security"),

  // ── GRN ───────────────────────────────────────────────────────────────
  viewGRN:    (r: Role) => has(r, "admin", "stores"),
  createGRN:  (r: Role) => has(r, "stores"),
  approveGRN: (r: Role) => has(r, "stores"),

  // ── Stock / Ledger ────────────────────────────────────────────────────
  viewStock:  (r: Role) => has(r, "admin", "stores", "purchase"),
  viewLedger: (r: Role) => has(r, "admin", "stores", "purchase"),

  // ── Production ────────────────────────────────────────────────────────
  viewProduction:  (r: Role) => has(r, "admin", "planning", "stores", "production"),
  createWO:        (r: Role) => has(r, "planning"),
  issueMaterials:  (r: Role) => has(r, "stores"),
  punchProduction: (r: Role) => has(r, "production"),

  // ── Sales Order ───────────────────────────────────────────────────────
  viewSO:     (r: Role) => has(r, "admin", "sales"),
  createSO:   (r: Role) => has(r, "sales"),

  // ── Dispatch ──────────────────────────────────────────────────────────
  viewDispatch:    (r: Role) => has(r, "admin", "stores", "accounts"),
  dispatch:        (r: Role) => has(r, "stores"),

  // ── Invoice ───────────────────────────────────────────────────────────
  viewInvoices:    (r: Role) => has(r, "admin", "accounts"),
  generateInvoice: (r: Role) => has(r, "accounts"),

  // ── Approvals ─────────────────────────────────────────────────────────
  viewApprovals: (r: Role) => has(r, "admin"),

  // ── Admin / Audit ─────────────────────────────────────────────────────
  viewAdmin: (r: Role) => has(r, "admin"),
  viewAudit: (r: Role) => has(r, "admin"),

  // ── Executive Dashboard ─────────────────────────────────────────────
  viewExecutiveDashboard: (r: Role) => has(r, "admin"),
};
