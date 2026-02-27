"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Item } from "@/lib/types";
import { bomService, itemService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { BOMBuilder } from "@/components/bom/BOMBuilder";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

export default function BomNewPage() {
  const router = useRouter();
  const { role, currentUser } = useAuth();
  const { toast } = useToast();

  const canEdit = can.editBOM(role);
  const canView = can.viewBOM(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [finishedGoods, setFinishedGoods] = React.useState<Item[]>([]);
  const [materialItems, setMaterialItems] = React.useState<Item[]>([]);

  React.useEffect(() => {
    if (!canView) return;
    setIsLoading(true);
    Promise.all([itemService.getItems(), bomService.getItemsForBOM()])
      .then(([items, mats]) => {
        setFinishedGoods(items.filter((i) => i.isActive && i.itemType === "FINISHED_GOOD"));
        setMaterialItems(mats);
      })
      .catch((err) => {
        toast({
          variant: "error",
          title: "Failed to load items",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      })
      .finally(() => setIsLoading(false));
  }, [canView, toast]);

  if (!canView) {
    return (
      <AccessDenied
        title="BOM Builder"
        message="Only admin/planning can create BOMs. Production has view-only access."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading BOM builder…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create BOM"
        description="Build a new BOM for a finished good."
      />

      <BOMBuilder
        mode="create"
        roleMode={canEdit ? "full" : "view"}
        finishedGoods={finishedGoods}
        materialItems={materialItems}
        isSaving={isSaving}
        onCancel={() => router.push("/masters/bom")}
        onSave={async (payload) => {
          if (!canEdit) return;
          setIsSaving(true);
          try {
            const bom = await bomService.createBOM({
              bomCode: payload.bomCode,
              finishedGoodItemId: payload.finishedGoodItemId,
              lines: payload.lines,
            }, { id: currentUser!.id, name: currentUser!.name });
            toast({ variant: "success", title: "BOM created" });
            router.push(`/masters/bom/${bom.id}`);
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

