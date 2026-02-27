"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import type { Item, PurchaseRequisition, PurchaseRequisitionItem } from "@/lib/types";
import { itemService, prService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { PRForm } from "@/components/purchase/PRForm";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

export default function PrEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const prId = params.id;

  const { role, currentUser, factory } = useAuth();
  const { toast } = useToast();

  const canEdit = can.createPR(role);
  const canView = canEdit;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const [pr, setPr] = React.useState<PurchaseRequisition | null>(null);
  const [prItems, setPrItems] = React.useState<PurchaseRequisitionItem[]>([]);

  React.useEffect(() => {
    if (!canView) return;
    setIsLoading(true);
    Promise.all([
      itemService.getItems(),
      prService.getPRById(prId),
      prService.getPRItems(prId),
    ])
      .then(([items, pr, prItems]) => {
        setItems(items);
        setPr(pr);
        setPrItems(prItems);
      })
      .catch((err) => {
        toast({
          variant: "error",
          title: "Failed to load PR",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      })
      .finally(() => setIsLoading(false));
  }, [canView, prId, toast]);

  if (!canView) {
    return (
      <AccessDenied
        title="Edit PR"
        message="Only planning role can edit draft PRs."
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${pr.prNumber}`}
        description="Only draft PRs can be edited."
      />

      <PRForm
        mode="edit"
        pr={pr}
        prItems={prItems}
        items={items}
        isSaving={isSaving}
        onCancel={() => router.push(`/purchase/pr/${pr.id}`)}
        onSave={async (payload) => {
          if (!canEdit) return;
          setIsSaving(true);
          try {
            await prService.updatePR({
              prId: pr.id,
              department: payload.department,
              items: payload.items,
            }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
            toast({ variant: "success", title: "PR updated" });
            router.push(`/purchase/pr/${pr.id}`);
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

