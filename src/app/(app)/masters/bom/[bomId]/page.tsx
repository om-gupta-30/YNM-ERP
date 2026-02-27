"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { BOM, BOMItem, Item } from "@/lib/types";
import { bomService, itemService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function BomDetailPage() {
  const params = useParams<{ bomId: string }>();
  const bomId = params.bomId;

  const { role, currentUser } = useAuth();
  const { toast } = useToast();
  const canView = can.viewBOM(role);
  const canEdit = can.editBOM(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [bom, setBom] = React.useState<BOM | null>(null);
  const [lines, setLines] = React.useState<BOMItem[]>([]);
  const [itemsById, setItemsById] = React.useState<Map<string, Item>>(new Map());

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [bom, lines, items] = await Promise.all([
        bomService.getBOMById(bomId),
        bomService.getBOMItems(bomId),
        itemService.getItems(),
      ]);
      setBom(bom);
      setLines(lines);
      setItemsById(new Map(items.map((i) => [i.id, i])));
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load BOM",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [bomId, toast]);

  React.useEffect(() => {
    if (!canView) return;
    void refresh();
  }, [canView, refresh]);

  if (!canView) {
    return (
      <AccessDenied
        title="BOM Details"
        message="Only admin/planning can manage BOMs. Production has view-only access."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading BOM…
      </div>
    );
  }

  if (!bom) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        BOM not found.
      </div>
    );
  }

  const fg = itemsById.get(bom.finishedGoodItemId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${bom.bomCode} (v${bom.version})`}
        description={fg ? `Finished Good: ${fg.itemCode} — ${fg.itemName}` : "Finished Good: —"}
        actions={
          <div className="flex gap-2">
            <Link href="/masters/bom">
              <Button variant="secondary">Back</Button>
            </Link>
            {canEdit ? (
              <Link href={`/masters/bom/${bom.id}/edit`}>
                <Button variant="secondary">Create new version</Button>
              </Link>
            ) : null}
            {canEdit ? (
              <Button
                variant="danger"
                onClick={() => setConfirmOpen(true)}
                disabled={!bom.isActive || isMutating}
              >
                Deactivate
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="ds-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
          <StatusBadge value={bom.isActive ? "Active" : "Inactive"} />
          <div>
            Materials: <span className="font-medium text-stone-900">{lines.length}</span>
          </div>
          <div className="text-stone-400">•</div>
          <div className="text-stone-500">
            Created: <span className="text-stone-700">{new Date(bom.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <DataTable
        rows={lines}
        columns={[
          {
            header: "Raw material / SFG",
            cell: (r) => {
              const it = itemsById.get(r.rawMaterialItemId);
              return it ? `${it.itemCode} — ${it.itemName}` : "—";
            },
          },
          {
            header: "Qty / unit",
            cell: (r) => String(r.quantityPerUnit),
            className: "text-right w-32",
          },
          {
            header: "Scrap %",
            cell: (r) => String(r.scrapPercentage),
            className: "text-right w-32",
          },
        ]}
        emptyState="No BOM lines found."
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate BOM?"
        description={`Deactivating ${bom.bomCode} v${bom.version} will make it unavailable for production planning.`}
        confirmLabel="Deactivate"
        tone="danger"
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
        }}
        onConfirm={() => {
          setIsMutating(true);
          bomService.deactivateBOM(bom.id, { id: currentUser!.id, name: currentUser!.name })
            .then(() => {
              toast({ variant: "success", title: "BOM deactivated" });
              setConfirmOpen(false);
              void refresh();
            })
            .catch((err) => {
              toast({
                variant: "error",
                title: "Deactivate failed",
                message: err instanceof Error ? err.message : "Unknown error",
              });
            })
            .finally(() => setIsMutating(false));
        }}
      />
    </div>
  );
}

