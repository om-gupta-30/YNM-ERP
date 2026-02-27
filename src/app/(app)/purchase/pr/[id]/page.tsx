"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  Item,
  PurchaseRequisition,
  PurchaseRequisitionItem,
  PurchaseRequisitionStatusEvent,
} from "@/lib/types";
import { itemService, prService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type ConfirmAction = "submit" | "approve" | "reject";

export default function PrDetailsPage() {
  const params = useParams<{ id: string }>();
  const prId = params.id;

  const { role, currentUser, factory } = useAuth();
  const { toast } = useToast();

  const canView = can.viewPR(role);
  const canSubmit = can.submitPR(role);
  const canDecision = can.approvePR(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [pr, setPr] = React.useState<PurchaseRequisition | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [prItems, setPrItems] = React.useState<PurchaseRequisitionItem[]>([]);
  const [history, setHistory] = React.useState<PurchaseRequisitionStatusEvent[]>([]);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction>("submit");

  const itemsById = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [pr, prItems, hist, items] = await Promise.all([
        prService.getPRById(prId),
        prService.getPRItems(prId),
        prService.getPRHistory(prId),
        itemService.getItems(),
      ]);
      setPr(pr);
      setPrItems(prItems);
      setHistory(hist);
      setItems(items);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load PR",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [prId, toast]);

  React.useEffect(() => {
    if (!canView) return;
    void refresh();
  }, [canView, refresh]);

  const isPurchaseRole = role === "purchase";
  const purchaseCanSee = pr?.status === "APPROVED";

  if (!canView) {
    return (
      <AccessDenied
        title="PR Details"
        message="Only planning can create/submit PRs. Admin can approve/reject. Purchase can view approved PRs."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading PR…
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        PR not found.
      </div>
    );
  }

  if (factory && pr.factory && pr.factory !== factory) {
    return <AccessDenied title="Factory scoped" message="This PR belongs to a different factory." />;
  }

  if (isPurchaseRole && !purchaseCanSee) {
    return (
      <AccessDenied
        title="PR Details"
        message="Purchase role can view approved PRs only."
      />
    );
  }

  const showSubmit = canSubmit && pr.status === "DRAFT";
  const showApproveReject = canDecision && pr.status === "SUBMITTED";
  const showEdit = role === "planning" && pr.status === "DRAFT";

  function openConfirm(action: ConfirmAction) {
    setConfirmAction(action);
    setConfirmOpen(true);
  }

  async function runAction() {
    if (!currentUser) return;
    if (!pr) return;
    setIsMutating(true);
    try {
      if (confirmAction === "submit") {
        await prService.submitPR({ prId: pr.id, by: currentUser.id }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
        toast({ variant: "success", title: "PR submitted" });
      } else if (confirmAction === "approve") {
        await prService.approvePR({ prId: pr.id, by: currentUser.id }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
        toast({ variant: "success", title: "PR approved" });
      } else {
        await prService.rejectPR({ prId: pr.id, by: currentUser.id, note: "Rejected" }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
        toast({ variant: "success", title: "PR rejected" });
      }
      await refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Action failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={pr.prNumber}
        description={`${pr.department} • Requested by ${pr.requestedBy}`}
        actions={
          <div className="flex gap-2">
            <Link href="/purchase/pr">
              <Button variant="secondary">Back</Button>
            </Link>
            {showEdit ? (
              <Link href={`/purchase/pr/${pr.id}/edit`}>
                <Button variant="secondary" disabled={isMutating}>
                  Edit
                </Button>
              </Link>
            ) : null}
            {showSubmit ? (
              <Button onClick={() => openConfirm("submit")} disabled={isMutating}>
                Submit PR
              </Button>
            ) : null}
            {showApproveReject ? (
              <>
                <Button onClick={() => openConfirm("approve")} disabled={isMutating}>
                  Approve
                </Button>
                <Button
                  variant="danger"
                  onClick={() => openConfirm("reject")}
                  disabled={isMutating}
                >
                  Reject
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="ds-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
          <StatusBadge value={pr.status} />
          <div className="text-stone-400">•</div>
          <div className="text-stone-500">
            Created:{" "}
            <span className="text-stone-700">{new Date(pr.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <DataTable
        rows={prItems}
        columns={[
          {
            header: "Item",
            cell: (r) => {
              const it = itemsById.get(r.itemId);
              return it ? `${it.itemCode} — ${it.itemName}` : "—";
            },
          },
          {
            header: "Quantity",
            cell: (r) => String(r.quantity),
            className: "text-right w-28",
          },
          {
            header: "UOM",
            cell: (r) => itemsById.get(r.itemId)?.uom ?? "—",
            className: "w-20",
          },
          { header: "Remarks", accessor: "remarks" },
        ]}
        emptyState="No items found."
      />

      <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm">
        <div className="text-sm font-semibold text-stone-950">Status history</div>
        <div className="mt-3 space-y-3">
          {history.length === 0 ? (
            <div className="text-sm text-stone-600">No status events.</div>
          ) : (
            history.map((e, idx) => (
              <div key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="mt-1 size-2 rounded-full bg-stone-900" />
                  {idx < history.length - 1 ? (
                    <div className="mt-2 h-full w-px bg-stone-200" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <StatusBadge value={e.status} />
                    <span className="text-stone-500">
                      {new Date(e.at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-stone-700">
                    By <span className="font-medium text-stone-900">{e.by}</span>
                    {e.note ? (
                      <>
                        {" "}
                        <span className="text-stone-400">•</span> {e.note}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={
          confirmAction === "submit"
            ? "Submit PR?"
            : confirmAction === "approve"
              ? "Approve PR?"
              : "Reject PR?"
        }
        description={
          confirmAction === "submit"
            ? `Submit ${pr.prNumber} for approval?`
            : confirmAction === "approve"
              ? `Approve ${pr.prNumber}?`
              : `Reject ${pr.prNumber}?`
        }
        confirmLabel={
          confirmAction === "submit"
            ? "Submit"
            : confirmAction === "approve"
              ? "Approve"
              : "Reject"
        }
        tone={confirmAction === "reject" ? "danger" : "default"}
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
        }}
        onConfirm={() => void runAction()}
      />
    </div>
  );
}

