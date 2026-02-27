"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { PurchaseRequisition, Supplier } from "@/lib/types";
import { prService, supplierService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

type Step = 1 | 2 | 3;

export default function RfqCreatePage() {
  const router = useRouter();
  const { role, currentUser, factory } = useAuth();
  const { toast } = useToast();

  const canEdit = can.editRFQ(role);
  const canView = can.viewRFQ(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [step, setStep] = React.useState<Step>(1);

  const [prs, setPrs] = React.useState<PurchaseRequisition[]>([]);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);

  const [selectedPrId, setSelectedPrId] = React.useState<string>("");
  const [selectedSupplierIds, setSelectedSupplierIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!canView) return;
    setIsLoading(true);
    Promise.all([
      prService.getPRs({ factory: factory ?? "YNM-HYD" }),
      supplierService.getSuppliers(),
    ])
      .then(([prs, suppliers]) => {
        setPrs(prs.filter((p) => p.status === "APPROVED"));
        setSuppliers(suppliers.filter((s) => s.isActive));
      })
      .catch((err) => {
        toast({
          variant: "error",
          title: "Failed to load prerequisites",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      })
      .finally(() => setIsLoading(false));
  }, [canView, factory, toast]);

  const selectedPr = prs.find((p) => p.id === selectedPrId) ?? null;

  function toggleSupplier(id: string) {
    setSelectedSupplierIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onConfirm() {
    if (!canEdit) return;
    if (!selectedPrId) {
      toast({ variant: "error", title: "Select an approved PR" });
      return;
    }
    if (selectedSupplierIds.length === 0) {
      toast({ variant: "error", title: "Select at least one supplier" });
      return;
    }
    setIsSaving(true);
    try {
      const rfq = await prService.createRFQ({ linkedPrId: selectedPrId, selectedSuppliers: selectedSupplierIds }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      await prService.submitRFQ({ rfqId: rfq.id }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toast({ variant: "success", title: "RFQ created and sent" });
      router.push(`/purchase/rfq/${rfq.id}/quotes`);
    } catch (err) {
      toast({
        variant: "error",
        title: "Create failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (!canView) {
    return (
      <AccessDenied
        title="Create RFQ"
        message="Purchase has full RFQ/PO access. Planning can view only. Admin can approve and view."
      />
    );
  }

  if (!canEdit) {
    return (
      <AccessDenied
        title="Create RFQ"
        message="Only the purchase role can create RFQs."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading RFQ wizard…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Create RFQ" description="Step wizard to create an RFQ from an approved PR." />

      <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-stone-950">Progress</div>
          <div className="text-sm text-stone-600">
            Step <span className="font-medium text-stone-900">{step}</span> / 3
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className={["rounded-md px-3 py-2 ring-1 ring-inset", step === 1 ? "bg-stone-900 text-white ring-stone-900" : "bg-stone-50 text-stone-700 ring-stone-200"].join(" ")}>
            1. Select Approved PR
          </div>
          <div className={["rounded-md px-3 py-2 ring-1 ring-inset", step === 2 ? "bg-stone-900 text-white ring-stone-900" : "bg-stone-50 text-stone-700 ring-stone-200"].join(" ")}>
            2. Choose Suppliers
          </div>
          <div className={["rounded-md px-3 py-2 ring-1 ring-inset", step === 3 ? "bg-stone-900 text-white ring-stone-900" : "bg-stone-50 text-stone-700 ring-stone-200"].join(" ")}>
            3. Confirm
          </div>
        </div>
      </div>

      {step === 1 ? (
        <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm space-y-3">
          <div>
            <div className="text-sm font-semibold text-stone-950">Select an approved PR</div>
            <div className="text-sm text-stone-600">Only approved PRs can be linked to an RFQ.</div>
          </div>
          <select
            value={selectedPrId}
            onChange={(e) => setSelectedPrId(e.target.value)}
            className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
          >
            <option value="">Select PR…</option>
            {prs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.prNumber} — {p.department} — {p.requestedBy}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => router.push("/purchase/rfq")}>
              Cancel
            </Button>
            <Button onClick={() => setStep(2)} disabled={!selectedPrId}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm space-y-3">
          <div>
            <div className="text-sm font-semibold text-stone-950">Choose suppliers</div>
            <div className="text-sm text-stone-600">Select one or more suppliers to request quotes.</div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {suppliers.map((s) => (
              <label key={s.id} className="flex items-start gap-3 rounded-md bg-stone-50 px-3 py-2 border border-stone-200">
                <input
                  type="checkbox"
                  className="mt-1 size-4 rounded border-stone-300"
                  checked={selectedSupplierIds.includes(s.id)}
                  onChange={() => toggleSupplier(s.id)}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-900">
                    {s.supplierCode} — {s.supplierName}
                  </div>
                  <div className="text-xs text-stone-500">{s.gstNumber ? `GST: ${s.gstNumber}` : "GST: —"}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-stone-600">
            <div>
              Selected: <span className="font-medium text-stone-900">{selectedSupplierIds.length}</span>
            </div>
            <StatusBadge value={selectedPr ? `Linked ${selectedPr.prNumber}` : "No PR"} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={selectedSupplierIds.length === 0}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm space-y-3">
          <div>
            <div className="text-sm font-semibold text-stone-950">Confirm RFQ creation</div>
            <div className="text-sm text-stone-600">This will create an RFQ and mark it as sent.</div>
          </div>

          <div className="rounded-md bg-stone-50 px-3 py-2 border border-stone-200 text-sm">
            <div>
              <span className="text-stone-600">PR:</span>{" "}
              <span className="font-medium text-stone-900">{selectedPr?.prNumber ?? "—"}</span>
            </div>
            <div className="mt-1">
              <span className="text-stone-600">Suppliers:</span>{" "}
              <span className="font-medium text-stone-900">{selectedSupplierIds.length}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep(2)} disabled={isSaving}>
              Back
            </Button>
            <Button onClick={() => void onConfirm()} disabled={isSaving}>
              {isSaving ? "Creating…" : "Create & Send RFQ"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

