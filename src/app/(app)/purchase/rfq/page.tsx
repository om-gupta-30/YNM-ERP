"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RFQ, RFQStatus } from "@/lib/types";
import { prService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTableSort } from "@/lib/hooks/useTableSort";

type StatusFilter = "ALL" | RFQStatus;

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "QUOTED", label: "Quoted" },
  { value: "CLOSED", label: "Closed" },
];

export default function RfqListPage() {
  const router = useRouter();
  const { role, currentUser, factory } = useAuth();
  const { toast } = useToast();

  const canView = can.viewRFQ(role);
  const canEdit = can.editRFQ(role);
  const canApprove = can.sendRFQ(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [rfqs, setRfqs] = React.useState<RFQ[]>([]);
  const [prById, setPrById] = React.useState<Map<string, { prNumber: string; status: string }>>(
    new Map(),
  );

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmRfq, setConfirmRfq] = React.useState<RFQ | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [rfqs, prs] = await Promise.all([
        prService.getRFQs({ factory: factory ?? "YNM-HYD" }),
        prService.getPRs({ factory: factory ?? "YNM-HYD" }),
      ]);
      setRfqs(rfqs);
      setPrById(new Map(prs.map((p) => [p.id, { prNumber: p.prNumber, status: p.status }])));
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load RFQs",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [factory, toast]);

  React.useEffect(() => {
    if (!canView) return;
    void refresh();
  }, [canView, refresh]);

  const visible = React.useMemo(() => {
    return statusFilter === "ALL" ? rfqs : rfqs.filter((r) => r.status === statusFilter);
  }, [rfqs, statusFilter]);

  const getSortValue = React.useCallback((row: RFQ, key: string) => {
    switch (key) {
      case "number": return row.rfqNumber;
      case "status": return row.status;
      default: return "";
    }
  }, []);

  const { sortConfig, onSort, sorted } = useTableSort(visible, getSortValue);

  function requestSend(rfq: RFQ) {
    setConfirmRfq(rfq);
    setConfirmOpen(true);
  }

  async function doSend(rfq: RFQ) {
    setIsMutating(true);
    try {
      await prService.submitRFQ({ rfqId: rfq.id }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "RFQ sent" });
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Send failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
      setConfirmOpen(false);
      setConfirmRfq(null);
    }
  }

  if (!canView) {
    return (
      <AccessDenied
        title="RFQ"
        message="Purchase has full RFQ/PO access. Planning can view only. Admin can approve and view."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFQ & Quotes"
        description="Request quotations against approved PRs and compare supplier offers."
        hint="Pick an approved PR, select suppliers to ask for prices, then compare their quotes side by side."
        flowCurrent="/purchase/rfq"
        flowNext={{ label: "Purchase Orders", href: "/purchase/po" }}
        actions={
          canEdit ? (
            <Button onClick={() => router.push("/purchase/rfq/create")} disabled={isLoading || isMutating}>
              Create RFQ
            </Button>
          ) : (
            <div className="text-sm text-stone-500">View only</div>
          )
        }
      />

      <div className="ds-filter-bar">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-sm font-medium text-stone-700">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-between sm:justify-end">
            <div className="text-sm text-stone-600">
              Total: <span className="font-medium text-stone-900">{sorted.length}</span>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
          Loading RFQs…
        </div>
      ) : (
        <DataTable
          rows={sorted}
          sortConfig={sortConfig}
          onSort={onSort}
          columns={[
            {
              header: "RFQ No",
              sortKey: "number",
              cell: (r) => (
                <Link href={`/purchase/rfq/${r.id}/comparison`} className="font-medium text-stone-900 hover:underline">
                  {r.rfqNumber}
                </Link>
              ),
            },
            {
              header: "Linked PR",
              cell: (r) => prById.get(r.linkedPrId)?.prNumber ?? "—",
            },
            { header: "Status", sortKey: "status", cell: (r) => <StatusBadge value={r.status} />, className: "w-28" },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  <Link href={`/purchase/rfq/${r.id}/quotes`}>
                    <Button variant="secondary" size="sm">
                      Quotes
                    </Button>
                  </Link>
                  <Link href={`/purchase/rfq/${r.id}/comparison`}>
                    <Button variant="secondary" size="sm">
                      Comparison
                    </Button>
                  </Link>
                  {canEdit && r.status === "DRAFT" ? (
                    <Button size="sm" onClick={() => requestSend(r)} disabled={isMutating}>
                      Send
                    </Button>
                  ) : null}
                  {canApprove ? (
                    <span className="text-xs text-stone-500 self-center">Approve via PO generation</span>
                  ) : null}
                </div>
              ),
              className: "text-right w-[360px]",
            },
          ]}
          emptyState="No RFQs yet. Create one from an approved Purchase Requisition."
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Send RFQ?"
        description={confirmRfq ? `Mark ${confirmRfq.rfqNumber} as sent to selected suppliers?` : "Are you sure?"}
        confirmLabel="Send"
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
          setConfirmRfq(null);
        }}
        onConfirm={() => {
          if (!confirmRfq) return;
          void doSend(confirmRfq);
        }}
      />
    </div>
  );
}

