"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { inventoryService, prService } from "@/lib/services";
import type { GRN, PurchaseOrder, PurchaseRequisition } from "@/lib/types";

type TabKey = "PR" | "GRN" | "PO";

export default function ApprovalCenterPage() {
  const { currentUser, role, factory } = useAuth();
  const { toast } = useToast();

  const canView = can.viewApprovals(role);
  const [tab, setTab] = React.useState<TabKey>("PR");
  const [isLoading, setIsLoading] = React.useState(true);
  const [prs, setPrs] = React.useState<PurchaseRequisition[]>([]);
  const [grns, setGrns] = React.useState<GRN[]>([]);
  const [pos, setPos] = React.useState<PurchaseOrder[]>([]);
  const [confirm, setConfirm] = React.useState<
    | null
    | { kind: "approvePR"; id: string }
    | { kind: "rejectPR"; id: string }
    | { kind: "rejectGRN"; id: string }
    | { kind: "approvePO"; id: string }
    | { kind: "rejectPO"; id: string }
  >(null);
  const [isMutating, setIsMutating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!factory) return;
    setIsLoading(true);
    setError(null);
    try {
      const [p, g, o] = await Promise.all([
        prService.getPRs({ factory }),
        inventoryService.getGRNs({ factory }),
        prService.getPOs({ factory }),
      ]);
      setPrs(p.filter((x) => x.status === "SUBMITTED"));
      setGrns(g.filter((x) => x.status === "DRAFT"));
      setPos(o.filter((x) => (x.approvalStatus ?? "PENDING") === "PENDING"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approval data.");
    } finally {
      setIsLoading(false);
    }
  }, [factory]);

  React.useEffect(() => {
    if (!canView) return;
    void refresh();
  }, [canView, refresh]);

  async function runConfirm() {
    if (!currentUser || !confirm) return;
    setIsMutating(true);
    try {
      if (confirm.kind === "approvePR") {
        await prService.approvePR({ prId: confirm.id, by: currentUser.id }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
        toast({ variant: "success", title: "PR approved", message: "Status updated to APPROVED." });
      }
      if (confirm.kind === "rejectPR") {
        await prService.rejectPR({ prId: confirm.id, by: currentUser.id, note: "Rejected in Approval Center" }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
        toast({ variant: "success", title: "PR rejected", message: "Status updated to REJECTED." });
      }
      if (confirm.kind === "rejectGRN") {
        await inventoryService.rejectGRN({ grnId: confirm.id });
        toast({ variant: "success", title: "GRN rejected", message: "GRN marked as REJECTED." });
      }
      if (confirm.kind === "approvePO") {
        await prService.approvePO({ poId: confirm.id }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
        toast({ variant: "success", title: "PO approved", message: "PO approval status updated." });
      }
      if (confirm.kind === "rejectPO") {
        await prService.rejectPO({ poId: confirm.id }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
        toast({ variant: "success", title: "PO rejected", message: "PO approval status updated." });
      }
      setConfirm(null);
      await refresh();
    } catch (e) {
      toast({
        title: "Action failed",
        message: e instanceof Error ? e.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setIsMutating(false);
    }
  }

  if (!currentUser) return <AccessDenied title="Sign in required" message="Please sign in to view approvals." />;
  if (!canView) return <AccessDenied title="Admin only" message="Only admins can access the Approval Center." />;

  const tabButton = (key: TabKey, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={[
        "rounded-md px-3 py-2 text-sm ring-1 ring-inset",
        tab === key
          ? "bg-stone-950 text-white ring-stone-950"
          : "bg-white text-stone-700 ring-stone-200 hover:bg-stone-50",
      ].join(" ")}
    >
      <span className="font-medium">{label}</span>{" "}
      <span className={tab === key ? "text-white/80" : "text-stone-500"}>({count})</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Center"
        description="Centralized approvals for purchase, inventory, and order workflows."
        hint="Items submitted by other users appear here for admin review. Approve or reject PRs, GRNs, and POs in one place."
      />

      {error ? (
        <div className="ds-alert-error">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {tabButton("PR", "PR approvals", prs.length)}
        {tabButton("GRN", "GRN approvals", grns.length)}
        {tabButton("PO", "PO approvals", pos.length)}
        <div className="ml-auto">
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={isLoading}>
            Refresh
          </Button>
        </div>
      </div>

      {tab === "PR" ? (
        <DataTable
          rows={prs}
          emptyState={isLoading ? "Loading…" : "No PRs pending approval."}
          columns={[
            { header: "PR No", cell: (r) => <div className="font-medium text-stone-900">{r.prNumber}</div> },
            { header: "Requested by", cell: (r) => <div className="text-stone-700">{r.requestedBy}</div> },
            { header: "Department", cell: (r) => <div className="text-stone-700">{r.department}</div> },
            { header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  <Button size="sm" onClick={() => setConfirm({ kind: "approvePR", id: r.id })} disabled={isMutating}>
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirm({ kind: "rejectPR", id: r.id })}
                    disabled={isMutating}
                  >
                    Reject
                  </Button>
                </div>
              ),
            },
          ]}
        />
      ) : null}

      {tab === "GRN" ? (
        <DataTable
          rows={grns}
          emptyState={isLoading ? "Loading…" : "No GRNs pending approval."}
          columns={[
            { header: "GRN No", cell: (r) => <div className="font-medium text-stone-900">{r.grnNumber}</div> },
            { header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  <Link href={`/inventory/grn/${r.id}`}>
                    <Button size="sm">Approve</Button>
                  </Link>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirm({ kind: "rejectGRN", id: r.id })}
                    disabled={isMutating}
                  >
                    Reject
                  </Button>
                </div>
              ),
            },
          ]}
        />
      ) : null}

      {tab === "PO" ? (
        <DataTable
          rows={pos}
          emptyState={isLoading ? "Loading…" : "No POs pending approval."}
          columns={[
            { header: "PO No", cell: (r) => <div className="font-medium text-stone-900">{r.poNumber}</div> },
            { header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
            {
              header: "Approval",
              cell: (r) => <StatusBadge value={r.approvalStatus ?? "PENDING"} />,
            },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  <Button size="sm" onClick={() => setConfirm({ kind: "approvePO", id: r.id })} disabled={isMutating}>
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirm({ kind: "rejectPO", id: r.id })}
                    disabled={isMutating}
                  >
                    Reject
                  </Button>
                </div>
              ),
            },
          ]}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.kind === "approvePR"
            ? "Approve PR?"
            : confirm?.kind === "rejectPR"
              ? "Reject PR?"
              : confirm?.kind === "rejectGRN"
                ? "Reject GRN?"
                : confirm?.kind === "approvePO"
                  ? "Approve PO?"
                  : confirm?.kind === "rejectPO"
                    ? "Reject PO?"
                    : "Confirm action"
        }
        description="This updates mock workflow status and writes an audit log entry."
        confirmLabel={confirm?.kind?.startsWith("reject") ? "Reject" : "Approve"}
        tone={confirm?.kind?.startsWith("reject") ? "danger" : "default"}
        onClose={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />
    </div>
  );
}

