"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import type { BOM, BOMItem, Item } from "@/lib/types";
import { bomService, itemService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { BOMBuilder } from "@/components/bom/BOMBuilder";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

export default function BomEditPage() {
  const router = useRouter();
  const params = useParams<{ bomId: string }>();
  const bomId = params.bomId;

  const { role, currentUser } = useAuth();
  const { toast } = useToast();

  const canEdit = can.editBOM(role);
  const canView = can.viewBOM(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [bom, setBom] = React.useState<BOM | null>(null);
  const [bomItems, setBomItems] = React.useState<BOMItem[]>([]);
  const [finishedGoods, setFinishedGoods] = React.useState<Item[]>([]);
  const [materialItems, setMaterialItems] = React.useState<Item[]>([]);

  React.useEffect(() => {
    if (!canView) return;
    setIsLoading(true);
    Promise.all([
      bomService.getBOMById(bomId),
      bomService.getBOMItems(bomId),
      itemService.getItems(),
      bomService.getItemsForBOM(),
    ])
      .then(([bom, lines, items, mats]) => {
        setBom(bom);
        setBomItems(lines);
        setFinishedGoods(items.filter((i) => i.isActive && i.itemType === "FINISHED_GOOD"));
        setMaterialItems(mats);
      })
      .catch((err) => {
        toast({
          variant: "error",
          title: "Failed to load BOM",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      })
      .finally(() => setIsLoading(false));
  }, [bomId, canView, toast]);

  if (!canView) {
    return (
      <AccessDenied
        title="BOM Builder"
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create new BOM version"
        description={`${bom.bomCode} (current v${bom.version}) — saving will create v${bom.version + 1}`}
      />

      <BOMBuilder
        mode="edit"
        roleMode={canEdit ? "full" : "view"}
        bom={bom}
        bomItems={bomItems}
        finishedGoods={finishedGoods}
        materialItems={materialItems}
        isSaving={isSaving}
        onCancel={() => router.push(`/masters/bom/${bom.id}`)}
        onSave={async (payload) => {
          if (!canEdit) return;
          setIsSaving(true);
          try {
            const next = await bomService.updateBOM({ bomId: bom.id, lines: payload.lines }, { id: currentUser!.id, name: currentUser!.name });
            toast({ variant: "success", title: "New BOM version created" });
            router.push(`/masters/bom/${next.id}`);
          } catch (err) {
            toast({
              variant: "error",
              title: "Save failed",
              message: err instanceof Error ? err.message : "Unknown error",
            });
          } finally {
            setIsSaving(false);
          }
        }}
      />
    </div>
  );
}

