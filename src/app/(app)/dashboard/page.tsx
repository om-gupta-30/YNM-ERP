"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NavIcon } from "@/components/layout/NavIcon";
import {
  itemService,
  supplierService,
  customerService,
  bomService,
  prService,
  inventoryService,
  productionService,
  salesService,
} from "@/lib/services";

type PipelineStage = {
  key: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  count: number | null;
  countLabel: string;
  tone: "neutral" | "active" | "warn";
  roles: string[];
};

type ActivityItem = {
  id: string;
  label: string;
  status: string;
  href: string;
  module: string;
};

const quickActions = [
  { label: "Create Purchase Req", href: "/purchase/pr/new", icon: "file-text", roles: ["planning"] as string[] },
  { label: "Create Work Order", href: "/production/work-orders", icon: "settings", roles: ["planning"] as string[] },
  { label: "Record Gate Entry", href: "/inventory/gate-entry", icon: "log-in", roles: ["security"] as string[] },
  { label: "Punch Production", href: "/production/dashboard", icon: "activity", roles: ["production"] as string[] },
  { label: "Create Sales Order", href: "/sales/orders", icon: "tag", roles: ["sales"] as string[] },
  { label: "Approve Pending", href: "/approvals", icon: "thumbs-up", roles: ["admin"] as string[] },
  { label: "View Stock", href: "/inventory/stock", icon: "database", roles: ["stores", "purchase"] as string[] },
];

export default function DashboardPage() {
  const { currentUser, role, factory } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [stages, setStages] = React.useState<PipelineStage[]>([]);
  const [activity, setActivity] = React.useState<ActivityItem[]>([]);

  React.useEffect(() => {
    if (!currentUser || !factory) return;
    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [items, suppliers, customers, boms, prs, rfqs, pos, gateEntries, grns, workOrders, salesOrders, dispatches, invoices] = await Promise.all([
          itemService.getItems().catch(() => []),
          supplierService.getSuppliers().catch(() => []),
          customerService.getCustomers().catch(() => []),
          bomService.getBOMs().catch(() => []),
          prService.getPRs({ factory }).catch(() => []),
          prService.getRFQs({ factory }).catch(() => []),
          prService.getPOs({ factory }).catch(() => []),
          inventoryService.getGateEntries({ factory }).catch(() => []),
          inventoryService.getGRNs({ factory }).catch(() => []),
          productionService.getWorkOrders({ factory }).catch(() => []),
          salesService.getSalesOrders({ factory }).catch(() => []),
          salesService.getDispatches({ factory }).catch(() => []),
          salesService.getInvoices({ factory }).catch(() => []),
        ]);

        if (!alive) return;

        const setupCount = items.length + suppliers.length + customers.length + boms.length;
        const pendingPrs = prs.filter((p) => p.status === "SUBMITTED" || p.status === "DRAFT").length;
        const openRfqs = rfqs.filter((r) => r.status !== "CLOSED").length;
        const openPos = pos.filter((p) => p.status !== "CLOSED").length;
        const procureCount = pendingPrs + openRfqs + openPos;
        const pendingGrns = grns.filter((g) => g.status === "DRAFT").length;
        const receiveCount = gateEntries.length > 0 || grns.length > 0 ? gateEntries.length + pendingGrns : 0;
        const activeWos = workOrders.filter((w) => w.status !== "COMPLETED").length;
        const pendingSos = salesOrders.filter((s) => s.status !== "COMPLETED").length;
        const pendingDispatches = dispatches.filter((d) => d.status !== "DISPATCHED").length;

        function tone(count: number, isSetup = false): "neutral" | "active" | "warn" {
          if (isSetup) return count === 0 ? "warn" : "neutral";
          return count === 0 ? "neutral" : "active";
        }

        setStages([
          {
            key: "setup",
            title: "Setup",
            description: "Items, Suppliers, Customers, BOMs",
            icon: "cube",
            href: "/masters/items",
            count: setupCount,
            countLabel: `${setupCount} master records`,
            tone: tone(setupCount, true),
            roles: ["planning", "purchase", "stores", "sales", "production"],
          },
          {
            key: "procure",
            title: "Procure",
            description: "PR, RFQ, Purchase Orders",
            icon: "shopping-cart",
            href: "/purchase/pr",
            count: procureCount,
            countLabel: `${pendingPrs} pending PR, ${openRfqs} open RFQ, ${openPos} open PO`,
            tone: tone(procureCount),
            roles: ["planning", "purchase"],
          },
          {
            key: "receive",
            title: "Receive",
            description: "Gate Entry, GRN",
            icon: "log-in",
            href: "/inventory/gate-entry",
            count: receiveCount,
            countLabel: `${gateEntries.length} gate entries, ${pendingGrns} pending GRN`,
            tone: tone(receiveCount),
            roles: ["stores", "security"],
          },
          {
            key: "make",
            title: "Make",
            description: "Work Orders, Production",
            icon: "settings",
            href: "/production/work-orders",
            count: activeWos,
            countLabel: `${activeWos} active work orders`,
            tone: tone(activeWos),
            roles: ["planning", "production", "stores"],
          },
          {
            key: "sell",
            title: "Sell",
            description: "Sales, Dispatch, Invoices",
            icon: "tag",
            href: "/sales/orders",
            count: pendingSos + pendingDispatches,
            countLabel: `${pendingSos} open orders, ${pendingDispatches} to dispatch`,
            tone: tone(pendingSos + pendingDispatches),
            roles: ["sales", "accounts"],
          },
        ]);

        const recentActivity: ActivityItem[] = [];
        for (const pr of prs.slice(0, 3)) {
          recentActivity.push({ id: `pr-${pr.id}`, label: pr.prNumber, status: pr.status, href: `/purchase/pr/${pr.id}`, module: "PR" });
        }
        for (const wo of workOrders.filter((w) => w.status !== "COMPLETED").slice(0, 3)) {
          recentActivity.push({ id: `wo-${wo.id}`, label: wo.woNumber, status: wo.status, href: `/production/work-orders`, module: "Work Order" });
        }
        for (const so of salesOrders.slice(0, 2)) {
          recentActivity.push({ id: `so-${so.id}`, label: so.soNumber, status: so.status, href: `/sales/orders`, module: "Sales" });
        }
        for (const inv of invoices.slice(0, 2)) {
          recentActivity.push({ id: `inv-${inv.id}`, label: inv.invoiceNumber, status: "issued", href: `/dispatch/invoices`, module: "Invoice" });
        }
        setActivity(recentActivity.slice(0, 8));
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load dashboard.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [currentUser, factory]);

  if (!currentUser) return <AccessDenied title="Sign in required" message="Please sign in to view the dashboard." />;

  const toneStyles = {
    neutral: "border-stone-200 bg-stone-50 text-stone-400",
    active: "border-gold-300 bg-gold-50 text-gold-600",
    warn: "border-amber-200 bg-amber-50 text-amber-600",
  };

  const visibleActions = quickActions.filter(
    (a) => a.roles.includes(role ?? ""),
  );

  return (
    <div className="space-y-8" style={{ animation: "fade-in 0.3s ease-out" }}>
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900">
          Welcome back, <span className="text-gold-700">{currentUser.name.split(" ")[0]}</span>
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Here&apos;s an overview of your ERP. The pipeline below shows the flow from setup to sales.
        </p>
      </div>

      {error && <div className="ds-alert-error">{error}</div>}

      {/* Pipeline */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
          Workflow Pipeline
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="ds-surface p-4">
                  <Skeleton className="mb-2 h-8 w-8 rounded-lg" />
                  <Skeleton className="mb-1 h-4 w-20" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))
            : stages.map((stage, idx) => {
                const clickable = role !== "admin" && stage.roles.includes(role ?? "");
                const cls = [
                  "group relative overflow-hidden rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm",
                  "transition-all duration-200 ease-out",
                  clickable ? "hover:shadow-lg hover:-translate-y-0.5 hover:border-gold-300/60 cursor-pointer" : "cursor-default",
                ].join(" ");
                const content = (
                  <>
                    <div className="flex items-start justify-between">
                      <div
                        className={[
                          "grid size-9 place-items-center rounded-lg border transition-colors duration-200",
                          toneStyles[stage.tone],
                        ].join(" ")}
                      >
                        <NavIcon name={stage.icon} className="size-4" />
                      </div>
                      {idx < stages.length - 1 && (
                        <span className="hidden text-stone-300 lg:block">→</span>
                      )}
                    </div>
                    <div className="mt-3 text-sm font-semibold text-stone-900">
                      {stage.title}
                    </div>
                    <p className="mt-0.5 text-[11px] text-stone-400">
                      {stage.description}
                    </p>
                    <p className="mt-2 text-xs font-medium text-stone-600">
                      {stage.countLabel}
                    </p>
                  </>
                );
                return clickable ? (
                  <Link key={stage.key} href={stage.href} className={cls}>
                    {content}
                  </Link>
                ) : (
                  <div key={stage.key} className={cls}>
                    {content}
                  </div>
                );
              })}
        </div>
      </div>

      {/* Quick Actions */}
      {visibleActions.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
            Quick Actions
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 rounded-xl border border-stone-200/80 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:border-gold-300/60 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <div className="grid size-8 place-items-center rounded-lg bg-gold-50 text-gold-600 border border-gold-200/60">
                  <NavIcon name={action.icon} className="size-4" />
                </div>
                <span className="text-sm font-medium text-stone-700">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
          Recent Activity
        </h2>
        <div className="overflow-hidden rounded-xl border border-stone-200/80 bg-white shadow-sm divide-y divide-stone-100">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))
          ) : activity.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-stone-400">
              No activity yet. Start by creating items in the Setup section.
            </div>
          ) : (
            activity.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center justify-between px-5 py-3 transition-colors duration-150 hover:bg-gold-50/40"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                    {item.module}
                  </span>
                  <span className="text-sm font-medium text-stone-700">{item.label}</span>
                </div>
                <StatusBadge value={item.status} />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
