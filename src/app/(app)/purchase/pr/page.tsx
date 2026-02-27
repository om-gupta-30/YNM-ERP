"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PurchaseRequisition, PurchaseRequisitionStatus } from "@/lib/types";
import { prService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, TableSkeleton } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TablePagination } from "@/components/ui/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useTableSort } from "@/lib/hooks/useTableSort";

type StatusFilter = "ALL" | PurchaseRequisitionStatus;

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CLOSED", label: "Closed" },
];

function matchesSearch(pr: PurchaseRequisition, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return pr.prNumber.toLowerCase().includes(query);
}

export default function PrListPage() {
  const router = useRouter();
  const { role, currentUser, factory } = useAuth();
  const { toast } = useToast();

  const canView = can.viewPR(role);
  const canCreate = can.createPR(role);
  const canSubmit = can.submitPR(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [prs, setPrs] = React.useState<PurchaseRequisition[]>([]);

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmPr, setConfirmPr] = React.useState<PurchaseRequisition | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await prService.getPRs({ factory: factory ?? "YNM-HYD" });
      setPrs(list);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load PRs",
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
    let base = prs;
    if (role === "purchase") base = base.filter((p) => p.status === "APPROVED");
    const byStatus =
      statusFilter === "ALL" ? base : base.filter((p) => p.status === statusFilter);
    return byStatus.filter((p) => matchesSearch(p, debouncedSearch));
  }, [prs, role, debouncedSearch, statusFilter]);

  const getSortValue = React.useCallback((row: PurchaseRequisition, key: string) => {
    switch (key) {
      case "number": return row.prNumber;
      case "by": return row.requestedBy;
      case "date": return row.createdAt;
      case "status": return row.status;
      default: return "";
    }
  }, []);

  const { sortConfig, onSort, sorted } = useTableSort(visible, getSortValue);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  function requestSubmit(pr: PurchaseRequisition) {
    setConfirmPr(pr);
    setConfirmOpen(true);
  }

  async function doSubmit(pr: PurchaseRequisition) {
    if (!currentUser) return;
    setIsMutating(true);
    try {
      await prService.submitPR({ prId: pr.id, by: currentUser.id }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "PR submitted" });
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Submit failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
      setConfirmOpen(false);
      setConfirmPr(null);
    }
  }

  if (!canView) {
    return (
      <AccessDenied
        title="Purchase Requisition"
        message="Only planning can create/submit PRs. Admin can approve/reject. Purchase can view approved PRs."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Requisition"
        description="Create, submit, and approve purchase requisitions."
        hint="This is where you request materials to buy. Create a PR, submit it for admin approval, then move to RFQ."
        flowCurrent="/purchase/pr"
        flowNext={{ label: "RFQ & Quotes", href: "/purchase/rfq" }}
        actions={
          canCreate ? (
            <Button onClick={() => router.push("/purchase/pr/new")} disabled={isLoading || isMutating}>
              New PR
            </Button>
          ) : null
        }
      />

      <div className="ds-filter-bar">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PR number"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
              disabled={role === "purchase"}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {role === "purchase" ? (
              <div className="text-xs text-stone-500">Purchase role can view approved PRs only.</div>
            ) : null}
          </div>
          <div className="flex items-end justify-between sm:justify-end" />
        </div>

        <div className="mt-3">
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={sorted.length}
            pageSize={pageSize}
            visibleCount={paged.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <DataTable
          rows={paged}
          sortConfig={sortConfig}
          onSort={onSort}
          columns={[
            {
              header: "PR Number",
              sortKey: "number",
              cell: (r) => (
                <Link href={`/purchase/pr/${r.id}`} className="font-medium text-stone-900 hover:underline">
                  {r.prNumber}
                </Link>
              ),
            },
            { header: "Requested By", sortKey: "by", accessor: "requestedBy" },
            {
              header: "Date",
              sortKey: "date",
              cell: (r) => new Date(r.createdAt).toLocaleDateString(),
              className: "w-32",
            },
            { header: "Status", sortKey: "status", cell: (r) => <StatusBadge value={r.status} />, className: "w-36" },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  <Link href={`/purchase/pr/${r.id}`}>
                    <Button variant="secondary" size="sm">
                      View
                    </Button>
                  </Link>
                  {canSubmit && r.status === "DRAFT" ? (
                    <Button
                      size="sm"
                      onClick={() => requestSubmit(r)}
                      disabled={isMutating}
                    >
                      Submit
                    </Button>
                  ) : null}
                </div>
              ),
              className: "text-right w-56",
            },
          ]}
          emptyState="No purchase requisitions yet. Click 'New PR' to request materials."
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Submit PR?"
        description={
          confirmPr
            ? `Submit ${confirmPr.prNumber} for approval?`
            : "Are you sure?"
        }
        confirmLabel="Submit"
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
          setConfirmPr(null);
        }}
        onConfirm={() => {
          if (!confirmPr) return;
          void doSubmit(confirmPr);
        }}
      />
    </div>
  );
}
