"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Customer, Dispatch, DispatchItem, Invoice, Item, SalesOrder, SalesOrderItem } from "@/lib/types";
import { customerService, itemService, salesService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const dispatchId = params.id;

  const { role, factory, currentUser } = useAuth();
  const { toast } = useToast();
  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  const viewOk = can.viewInvoices(role);
  const canGenerate = can.generateInvoice(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);

  const [dispatch, setDispatch] = React.useState<Dispatch | null>(null);
  const [dispatchItems, setDispatchItems] = React.useState<DispatchItem[]>([]);
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [so, setSo] = React.useState<SalesOrder | null>(null);
  const [soItems, setSoItems] = React.useState<SalesOrderItem[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [items, setItems] = React.useState<Item[]>([]);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [dispatch, di, inv, customers, items] = await Promise.all([
        salesService.getDispatchById(dispatchId),
        salesService.getDispatchItems(dispatchId),
        salesService.getInvoiceByDispatchId(dispatchId),
        customerService.getCustomers(),
        itemService.getItems(),
      ]);
      setDispatch(dispatch);
      setDispatchItems(di);
      setInvoice(inv);
      setCustomers(customers);
      setItems(items);
      if (dispatch) {
        const [so, soItems] = await Promise.all([
          salesService.getSalesOrderById(dispatch.soId),
          salesService.getSalesOrderItems(dispatch.soId),
        ]);
        setSo(so);
        setSoItems(soItems);
      } else {
        setSo(null);
        setSoItems([]);
      }
    } catch (err) {
      toastRef.current({
        variant: "error",
        title: "Failed to load invoice",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [dispatchId]);

  React.useEffect(() => {
    if (!viewOk) return;
    void refresh();
  }, [viewOk, dispatchId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onGenerate() {
    if (!canGenerate) return;
    setIsMutating(true);
    try {
      const inv = await salesService.generateInvoice({ dispatchId }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toastRef.current({ variant: "success", title: "Invoice generated" });
      setInvoice(inv);
    } catch (err) {
      toastRef.current({
        variant: "error",
        title: "Generate failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
    }
  }

  if (!viewOk) {
    return (
      <AccessDenied
        title="Invoice"
        message="Accounts generates invoices. Stores dispatches goods. Admin has full view. Other roles have no access."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading invoice…
      </div>
    );
  }

  if (!dispatch || !so) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Invoice not available.
      </div>
    );
  }

  if (factory && dispatch.factory && dispatch.factory !== factory) {
    return <AccessDenied title="Factory scoped" message="This dispatch belongs to a different factory." />;
  }

  const customerById = new Map(customers.map((c) => [c.id, c]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const soItemByItem = new Map(soItems.map((i) => [i.itemId, i]));

  const customer = customerById.get(so.customerId);
  const gstPercent = 18;

  const lines = dispatchItems.map((di) => {
    const it = itemById.get(di.itemId);
    const soLine = soItemByItem.get(di.itemId);
    const rate = soLine?.rate ?? 0;
    const amount = di.quantityDispatched * rate;
    return {
      id: di.id,
      item: it ? `${it.itemCode} — ${it.itemName}` : "—",
      qty: di.quantityDispatched,
      rate,
      amount,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const tax = (subtotal * gstPercent) / 100;
  const total = subtotal + tax;

  return (
    <div className="space-y-6">
      <PageHeader
        title={invoice ? invoice.invoiceNumber : "Invoice (Draft)"}
        description={`Dispatch: ${dispatch.dispatchNumber} • SO: ${so.soNumber}`}
        actions={
          <div className="flex gap-2">
            <Link href="/dispatch">
              <Button variant="secondary">Back</Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                window.print();
              }}
              disabled={!invoice}
            >
              Print
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast({ variant: "info", title: "PDF download", message: "PDF export coming soon." })}
              disabled={!invoice}
            >
              Download PDF
            </Button>
            {canGenerate && !invoice ? (
              <Button onClick={() => void onGenerate()} disabled={isMutating || dispatch.status !== "DISPATCHED"}>
                {isMutating ? "Generating…" : "Generate invoice"}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm print:shadow-none print:ring-0">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-lg font-semibold text-stone-950">YNM Safety</div>
            <div className="text-sm text-stone-600">Tax invoice</div>
          </div>
          <div className="text-right text-sm text-stone-700">
            <div><span className="text-stone-500">Invoice:</span> {invoice ? invoice.invoiceNumber : "—"}</div>
            <div><span className="text-stone-500">Date:</span> {invoice ? new Date(invoice.createdAt).toLocaleDateString() : "—"}</div>
            <div><span className="text-stone-500">GST %:</span> {gstPercent}%</div>
            <div className="mt-2"><StatusBadge value={dispatch.status} /></div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md bg-stone-50 p-3 border border-stone-200">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-600">Bill to</div>
            <div className="mt-1 text-sm font-medium text-stone-900">{customer?.customerName ?? "—"}</div>
            <div className="mt-1 text-sm text-stone-700 whitespace-pre-line">{customer?.billingAddress ?? "—"}</div>
            <div className="mt-1 text-xs text-stone-500">GST: {customer?.gstNumber ?? "—"}</div>
          </div>
          <div className="rounded-md bg-stone-50 p-3 border border-stone-200">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-600">Ship to</div>
            <div className="mt-1 text-sm font-medium text-stone-900">{customer?.customerName ?? "—"}</div>
            <div className="mt-1 text-sm text-stone-700 whitespace-pre-line">{customer?.shippingAddress ?? "—"}</div>
            <div className="mt-1 text-xs text-stone-500">Contact: {customer?.contactPerson ?? "—"} • {customer?.phone ?? "—"}</div>
          </div>
        </div>

        <div className="mt-6 ds-table-wrap ring-0 shadow-none">
          <div className="ds-table-scroll">
            <table className="ds-table">
              <thead className="ds-thead">
              <tr>
                <th className="ds-th">Item</th>
                <th className="ds-th text-right">Qty</th>
                <th className="ds-th text-right">Rate</th>
                <th className="ds-th text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="ds-td">{l.item}</td>
                  <td className="ds-td text-right">{l.qty}</td>
                  <td className="ds-td text-right">{l.rate.toFixed(2)}</td>
                  <td className="ds-td text-right">{l.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-sm space-y-2 text-sm">
            <div className="flex justify-between">
              <div className="text-stone-600">Subtotal</div>
              <div className="font-medium text-stone-900">{subtotal.toFixed(2)}</div>
            </div>
            <div className="flex justify-between">
              <div className="text-stone-600">GST ({gstPercent}%)</div>
              <div className="font-medium text-stone-900">{tax.toFixed(2)}</div>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-2">
              <div className="text-stone-600">Total</div>
              <div className="text-base font-semibold text-stone-950">{total.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-stone-500">
          This invoice is generated from dispatch quantities and SO rates. No accounting postings are performed.
        </div>
      </div>
    </div>
  );
}

