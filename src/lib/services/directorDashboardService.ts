import type { FactoryCode } from "@/lib/types";
import { inventoryService } from "@/lib/services/inventoryService";
import { itemService } from "@/lib/services/itemService";
import { prService } from "@/lib/services/prService";
import { productionService } from "@/lib/services/productionService";
import { salesService } from "@/lib/services/salesService";

function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

function fmtMonthLabel(key: string) {
  const [y, m] = key.split("-").map((x) => Number(x));
  const d = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  return d.toLocaleString(undefined, { month: "short" });
}

function startOfMonthIso(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return x.toISOString();
}

export type DirectorKpis = {
  totalInventoryItems: number;
  pendingPR: number;
  activeWorkOrders: number;
  monthlySalesAmount: number;
};

export type DirectorCharts = {
  productionVsSales: { months: string[]; production: number[]; sales: number[] };
  inventoryByCategory: Array<{ key: string; label: string; value: number; color: string }>;
};

const PIE_COLORS = ["#18181b", "#52525b", "#a1a1aa", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444"];

export const directorDashboardService = {
  async getKpis(factory: FactoryCode): Promise<DirectorKpis> {
    const [items, prs, wos, invoices] = await Promise.all([
      itemService.getItems(),
      prService.getPRs({ factory }),
      productionService.getWorkOrders({ factory }),
      salesService.getInvoices({ factory }),
    ]);

    const pendingPR = prs.filter((p) => p.status === "SUBMITTED").length;
    const activeWorkOrders = wos.filter((w) => w.status === "OPEN" || w.status === "IN_PROGRESS").length;

    const now = new Date();
    const monthStart = startOfMonthIso(now).slice(0, 10); // YYYY-MM-DD
    const monthlySalesAmount = invoices
      .filter((i) => i.createdAt.slice(0, 10) >= monthStart)
      .reduce((sum, i) => sum + i.totalAmount + i.taxAmount, 0);

    return {
      totalInventoryItems: items.length,
      pendingPR,
      activeWorkOrders,
      monthlySalesAmount: Number(monthlySalesAmount.toFixed(2)),
    };
  },

  async getCharts(factory: FactoryCode): Promise<DirectorCharts> {
    const [items, stock, ledger] = await Promise.all([
      itemService.getItems(),
      inventoryService.getCurrentStock({ factory }),
      inventoryService.getStockLedger({ factory }),
    ]);

    // Production vs Sales by month (last 6 distinct months)
    const prodByMonth: Record<string, number> = {};
    const salesByMonth: Record<string, number> = {};

    for (const l of ledger) {
      const mk = monthKey(l.createdAt);
      if (l.referenceType === "PRODUCTION" && l.transactionType === "INWARD") {
        prodByMonth[mk] = (prodByMonth[mk] ?? 0) + l.quantity;
      }
      if (l.referenceType === "DISPATCH" && l.transactionType === "OUTWARD") {
        salesByMonth[mk] = (salesByMonth[mk] ?? 0) + l.quantity;
      }
    }

    const monthsSorted = Array.from(
      new Set([...Object.keys(prodByMonth), ...Object.keys(salesByMonth)]),
    ).sort((a, b) => a.localeCompare(b));
    const lastMonths = monthsSorted.slice(-6);
    const months = lastMonths.map(fmtMonthLabel);
    const production = lastMonths.map((k) => Number((prodByMonth[k] ?? 0).toFixed(2)));
    const sales = lastMonths.map((k) => Number((salesByMonth[k] ?? 0).toFixed(2)));

    // Inventory category distribution (by on-hand quantity)
    const byCat: Record<string, number> = {};
    for (const it of items) {
      if (!it.isActive) continue;
      const qty = stock[it.id] ?? 0;
      const cat = it.category?.trim() || "Uncategorized";
      byCat[cat] = (byCat[cat] ?? 0) + qty;
    }

    const slices = Object.entries(byCat)
      .map(([cat, value]) => ({ key: cat, label: cat, value: Number(value.toFixed(2)) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 7)
      .map((x, idx) => ({ ...x, color: PIE_COLORS[idx % PIE_COLORS.length] }));

    return {
      productionVsSales: { months, production, sales },
      inventoryByCategory: slices,
    };
  },
};

