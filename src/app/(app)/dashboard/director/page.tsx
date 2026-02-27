"use client";

import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { directorDashboardService } from "@/lib/services/directorDashboardService";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ExecutiveDashboardPage() {
  const { currentUser, role, factory } = useAuth();

  const canView = can.viewExecutiveDashboard(role);
  const [isLoading, setIsLoading] = React.useState(true);
  const [kpis, setKpis] = React.useState<null | Awaited<ReturnType<(typeof directorDashboardService)["getKpis"]>>>(null);
  const [charts, setCharts] = React.useState<null | Awaited<ReturnType<(typeof directorDashboardService)["getCharts"]>>>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!factory || !canView) return;
    let alive = true;
    setIsLoading(true);
    setError(null);
    Promise.all([
      directorDashboardService.getKpis(factory),
      directorDashboardService.getCharts(factory),
    ])
      .then(([k, c]) => {
        if (!alive) return;
        setKpis(k);
        setCharts(c);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load executive dashboard.");
      })
      .finally(() => {
        if (!alive) return;
        setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [factory, canView]);

  if (!currentUser) return <AccessDenied title="Sign in required" message="Please sign in to view this dashboard." />;
  if (!canView) return <AccessDenied title="Admin only" message="You do not have access to this dashboard." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        description="Cross-functional snapshot across procurement, inventory, production, and sales."
        hint="High-level charts and KPIs for directors. Shows trends across all departments."
      />

      {error ? (
        <div className="ds-alert-error">{error}</div>
      ) : null}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total inventory items"
          value={isLoading ? <Skeleton className="h-7 w-14" /> : (kpis?.totalInventoryItems ?? 0)}
          hint="Item Master total"
        />
        <KpiCard
          label="Pending PR approvals"
          value={isLoading ? <Skeleton className="h-7 w-10" /> : (kpis?.pendingPR ?? 0)}
          hint="Submitted PRs (factory scoped)"
        />
        <KpiCard
          label="Active work orders"
          value={isLoading ? <Skeleton className="h-7 w-10" /> : (kpis?.activeWorkOrders ?? 0)}
          hint="Open + in progress"
        />
        <KpiCard
          label="Monthly sales summary"
          value={isLoading ? <Skeleton className="h-7 w-24" /> : money(kpis?.monthlySalesAmount ?? 0)}
          hint="Invoices (incl. GST) this month"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart
          title="Production vs Sales"
          subtitle="Last 6 months (stock ledger: PRODUCTION IN vs DISPATCH OUT)"
          categories={charts?.productionVsSales.months ?? ["—", "—", "—", "—", "—", "—"]}
          series={[
            {
              key: "production",
              label: "Production",
              barClass: "fill-sky-500",
              swatchClass: "bg-sky-500",
              values: charts?.productionVsSales.production ?? [0, 0, 0, 0, 0, 0],
            },
            {
              key: "sales",
              label: "Sales",
              barClass: "fill-stone-800",
              swatchClass: "bg-stone-800",
              values: charts?.productionVsSales.sales ?? [0, 0, 0, 0, 0, 0],
            },
          ]}
        />

        <PieChart
          title="Inventory category distribution"
          subtitle="On-hand quantity distribution by item category"
          slices={charts?.inventoryByCategory ?? []}
        />
      </div>
    </div>
  );
}
