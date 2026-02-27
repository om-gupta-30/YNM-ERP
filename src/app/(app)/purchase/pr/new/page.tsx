"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Item } from "@/lib/types";
import { itemService, prService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { PRForm } from "@/components/purchase/PRForm";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

export default function PrNewPage() {
  const router = useRouter();
  const { role, currentUser, factory } = useAuth();
  const { toast } = useToast();

  const canCreate = can.createPR(role);
  const canView = canCreate;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);

  React.useEffect(() => {
    if (!canView) return;
    setIsLoading(true);
    itemService.getItems()
      .then((list) => setItems(list))
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
        title="Create PR"
        message="Only planning role can create purchase requisitions."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading PR form…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Purchase Requisition"
        description="Create a new purchase requisition draft."
      />

      <PRForm
        mode="create"
        items={items}
        isSaving={isSaving}
        onCancel={() => router.push("/purchase/pr")}
        onSave={async (payload) => {
          if (!currentUser) return;
          setIsSaving(true);
          try {
            const pr = await prService.createPR({
              requestedBy: currentUser.id,
              department: payload.department,
              items: payload.items,
              factory: factory ?? "YNM-HYD",
            }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
            toast({ variant: "success", title: "PR draft created" });
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

