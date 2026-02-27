"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Customer, Dispatch, Invoice, SalesOrder } from "@/lib/types";
import { customerService, salesService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { FormModal } from "@/components/ui/FormModal";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { useTableSort } from "@/lib/hooks/useTableSort";

export default function InvoicesListPage() {
  const router = useRouter();
  const { role, factory, currentUser } = useAuth();
  const { toast } = useToast();
  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  const viewOk = can.viewInvoices(role);
  const canGenerate = can.generateInvoice(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [dispatches, setDispatches] = React.useState<Dispatch[]>([]);
  const [orders, setOrders] = React.useState<SalesOrder[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);

  const [open, setOpen] = React.useState(false);
  const [selectedDispatchId, setSelectedDispatchId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [inv, dsp, so, cust] = await Promise.all([
        salesService.getInvoices({ factory: factory ?? "YNM-HYD" }),
        salesService.getDispatches({ factory: factory ?? "YNM-HYD" }),
        salesService.getSalesOrders({ factory: factory ?? "YNM-HYD" }),
        customerService.getCustomers(),
      ]);
      setInvoices(inv);
      setDispatches(dsp);
      setOrders(so);
      setCustomers(cust);
    } catch (err) {
      toastRef.current({
        variant: "error",
        title: "Failed to load invoices",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [factory]);

  React.useEffect(() => {
    if (!viewOk) return;
    void refresh();
  }, [viewOk, factory]); // eslint-disable-line react-hooks/exhaustive-deps

  const invoicedDispatchIds = React.useMemo(
    () => new Set(invoices.map((i) => i.dispatchId)),
    [invoices],
  );

  const eligibleDispatches = React.useMemo(
    () => dispatches.filter((d) => d.status === "DISPATCHED" && !invoicedDispatchIds.has(d.id)),
    [dispatches, invoicedDispatchIds],
  );

  const getSortValue = React.useCallback((row: Invoice, key: string) => {
    if (key === "number") return row.invoiceNumber;
    if (key === "total") return row.totalAmount;
    if (key === "date") return row.createdAt;
    return "";
  }, []);

  const { sortConfig, onSort, sorted } = useTableSort(invoices, getSortValue);

  async function onCreate() {
    setError(null);
    if (!selectedDispatchId) {
      setError("Select a dispatch.");
      return;
    }
    setIsMutating(true);
    try {
      const inv = await salesService.generateInvoice(
        { dispatchId: selectedDispatchId },
        { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined },
      );
      toastRef.current({ variant: "success", title: "Invoice generated" });
      setOpen(false);
      await refresh();
      router.push(`/dispatch/invoice/${inv.dispatchId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setIsMutating(false);
    }
  }

  if (!viewOk) {
    return (
      <AccessDenied
        title="Invoices"
        message="Accounts can generate/view invoices. Admin has full view. Other roles have no access."
      />
    );
  }

  const dispatchById = new Map(dispatches.map((d) => [d.id, d]));
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const customerById = new Map(customers.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Invoices generated from dispatches."
        hint="After goods are dispatched, generate an invoice to bill the customer. This is the final step in the sales flow."
        flowCurrent="/dispatch/invoices"
        actions={
          canGenerate ? (
            <Button onClick={() => { setSelectedDispatchId(eligibleDispatches[0]?.id ?? ""); setOpen(true); }} disabled={isLoading || isMutating}>
              Create Invoice
            </Button>
          ) : (
            <div className="text-sm text-stone-500">View only</div>
          )
        }
      />

      {isLoading ? (
        <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
          Loading invoices…
        </div>
      ) : (
        <DataTable
          rows={sorted}
          sortConfig={sortConfig}
          onSort={onSort}
          columns={[
            {
              header: "Invoice No.",
              sortKey: "number",
              cell: (r) => (
                <Link href={`/dispatch/invoice/${r.dispatchId}`} className="font-medium text-stone-900 hover:underline">
                  {r.invoiceNumber}
                </Link>
              ),
            },
            {
              header: "Dispatch",
              cell: (r) => dispatchById.get(r.dispatchId)?.dispatchNumber ?? "—",
            },
            {
              header: "Customer",
              cell: (r) => {
                const dsp = dispatchById.get(r.dispatchId);
                const so = dsp ? orderById.get(dsp.soId) : null;
                const c = so ? customerById.get(so.customerId) : null;
                return c ? `${c.customerCode} — ${c.customerName}` : "—";
              },
            },
            {
              header: "Total",
              sortKey: "total",
              cell: (r) => r.totalAmount.toFixed(2),
              className: "text-right w-28",
            },
            {
              header: "Created",
              sortKey: "date",
              cell: (r) => new Date(r.createdAt).toLocaleString(),
              className: "w-44",
            },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex justify-end">
                  <Link href={`/dispatch/invoice/${r.dispatchId}`}>
                    <Button variant="secondary" size="sm">View</Button>
                  </Link>
                </div>
              ),
              className: "text-right w-24",
            },
          ]}
          emptyState="No invoices yet. Invoices are generated after dispatching goods to a customer."
        />
      )}

      <FormModal
        open={open}
        title="Create Invoice"
        description="Select a dispatched delivery to generate an invoice."
        onClose={() => {
          if (isMutating) return;
          setOpen(false);
          setError(null);
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isMutating}>
              Cancel
            </Button>
            <Button onClick={() => void onCreate()} disabled={isMutating || !selectedDispatchId}>
              {isMutating ? "Generating…" : "Create"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Dispatch</label>
            {eligibleDispatches.length === 0 ? (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                No dispatched deliveries awaiting invoicing. Dispatch goods first.
              </div>
            ) : (
              <select
                value={selectedDispatchId}
                onChange={(e) => setSelectedDispatchId(e.target.value)}
                className="h-9 w-full rounded-md bg-white px-3 text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400"
              >
                <option value="">Select dispatch…</option>
                {eligibleDispatches.map((d) => {
                  const so = orderById.get(d.soId);
                  const c = so ? customerById.get(so.customerId) : null;
                  return (
                    <option key={d.id} value={d.id}>
                      {d.dispatchNumber} • {so?.soNumber ?? "—"} • {c ? `${c.customerCode} — ${c.customerName}` : "—"}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
          {error ? (
            <div className="ds-alert-error text-sm">{error}</div>
          ) : null}
        </div>
      </FormModal>
    </div>
  );
}

