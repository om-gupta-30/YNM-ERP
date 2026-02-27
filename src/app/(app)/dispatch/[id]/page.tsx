"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Customer, Dispatch, DispatchItem, Item, SalesOrder, SalesOrderItem } from "@/lib/types";
import { customerService, inventoryService, itemService, salesService } from "@/lib/services";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";

export default function DispatchDetailPage() {
  const params = useParams<{ id: string }>();
  const dispatchId = params.id;

  const { role, factory, currentUser } = useAuth();
  const { toast } = useToast();
  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  const viewOk = can.viewDispatch(role);
  const canDispatch = can.dispatch(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);

  const [dispatch, setDispatch] = React.useState<Dispatch | null>(null);
  const [dispatchItems, setDispatchItems] = React.useState<DispatchItem[]>([]);
  const [so, setSo] = React.useState<SalesOrder | null>(null);
  const [soItems, setSoItems] = React.useState<SalesOrderItem[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [items, setItems] = React.useState<Item[]>([]);
  const [stock, setStock] = React.useState<Record<string, number>>({});

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [dispatch, di, customers, items, stock] = await Promise.all([
        salesService.getDispatchById(dispatchId),
        salesService.getDispatchItems(dispatchId),
        customerService.getCustomers(),
        itemService.getItems(),
        inventoryService.getCurrentStock({ factory: factory ?? "YNM-HYD" }),
      ]);
      setDispatch(dispatch);
      setDispatchItems(di);
      setCustomers(customers);
      setItems(items);
      setStock(stock);

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
        title: "Failed to load dispatch",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [dispatchId, factory]);

  React.useEffect(() => {
    if (!viewOk) return;
    void refresh();
  }, [viewOk, dispatchId, factory]); // eslint-disable-line react-hooks/exhaustive-deps

  const customerById = new Map(customers.map((c) => [c.id, c]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const soItemByItem = new Map(soItems.map((i) => [i.itemId, i]));

  const rows = dispatchItems.map((di) => {
    const it = itemById.get(di.itemId);
    const soLine = soItemByItem.get(di.itemId);
    const orderedQty = soLine?.quantity ?? 0;
    const available = stock[di.itemId] ?? 0;
    return {
      id: di.id,
      itemId: di.itemId,
      item: it ? `${it.itemCode} — ${it.itemName}` : "—",
      orderedQty,
      available,
      quantityDispatched: di.quantityDispatched,
    };
  });

  async function onDispatch() {
    if (!dispatch) return;
    setIsMutating(true);
    try {
      await salesService.dispatchGoods({
        dispatchId: dispatch.id,
        items: rows.map((r) => ({
          itemId: r.itemId,
          quantityDispatched: r.quantityDispatched,
        })),
      }, { id: currentUser!.id, name: currentUser!.name, factory: factory ?? undefined });
      toastRef.current({ variant: "success", title: "Goods dispatched and stock updated" });
      setConfirmOpen(false);
      await refresh();
    } catch (err) {
      toastRef.current({
        variant: "error",
        title: "Dispatch failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsMutating(false);
    }
  }

  if (!viewOk) {
    return (
      <AccessDenied
        title="Dispatch Details"
        message="Stores dispatch goods. Accounts generates invoices. Admin has full view. Other roles have no access."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Loading dispatch…
      </div>
    );
  }

  if (!dispatch || !so) {
    return (
      <div className="rounded-lg bg-white p-6 text-sm text-stone-600 border border-stone-200 shadow-sm">
        Dispatch not found.
      </div>
    );
  }

  if (factory && dispatch.factory && dispatch.factory !== factory) {
    return <AccessDenied title="Factory scoped" message="This dispatch belongs to a different factory." />;
  }

  const customer = customerById.get(so.customerId);
  const readOnly = dispatch.status === "DISPATCHED" || !canDispatch;

  return (
    <div className="space-y-6">
      <PageHeader
        title={dispatch.dispatchNumber}
        description={[
          `SO: ${so.soNumber}`,
          customer ? `Customer: ${customer.customerCode} — ${customer.customerName}` : "Customer: —",
        ].join(" • ")}
        actions={
          <div className="flex gap-2">
            <Link href="/dispatch">
              <Button variant="secondary">Back</Button>
            </Link>
            {dispatch.status === "DISPATCHED" ? (
              <Link href={`/dispatch/invoice/${dispatch.id}`}>
                <Button variant="secondary">Invoice</Button>
              </Link>
            ) : null}
            {canDispatch && dispatch.status === "PENDING" ? (
              <Button onClick={() => setConfirmOpen(true)} disabled={isMutating}>
                Dispatch goods
              </Button>
            ) : (
              <div className="text-sm text-stone-500 self-center">{readOnly ? "Read-only" : "View only"}</div>
            )}
          </div>
        }
      />

      <div className="rounded-lg bg-white p-5 border border-stone-200 shadow-sm">
        <div className="text-sm font-semibold text-stone-950">Workflow</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-md bg-stone-50 px-3 py-2 border border-stone-200 text-sm text-stone-700">
            1. Sales order
            <div className="mt-1 text-xs text-stone-500">{so.status}</div>
          </div>
          <div className={["rounded-md px-3 py-2 ring-1 ring-inset text-sm", dispatch.status === "PENDING" ? "bg-stone-900 text-white ring-stone-900" : "bg-stone-50 text-stone-700 ring-stone-200"].join(" ")}>
            2. Dispatch
            <div className="mt-1 text-xs opacity-80">{dispatch.status}</div>
          </div>
          <div className={["rounded-md px-3 py-2 ring-1 ring-inset text-sm", dispatch.status === "DISPATCHED" ? "bg-stone-900 text-white ring-stone-900" : "bg-stone-50 text-stone-700 ring-stone-200"].join(" ")}>
            3. Invoice
            <div className="mt-1 text-xs opacity-80">{dispatch.status === "DISPATCHED" ? "Ready" : "Pending"}</div>
          </div>
        </div>
      </div>

      <DataTable
        rows={rows}
        columns={[
          { header: "Item", accessor: "item" },
          { header: "Ordered", cell: (r) => String(r.orderedQty), className: "text-right w-24" },
          { header: "Available", cell: (r) => String(r.available), className: "text-right w-24" },
          {
            header: "Dispatch qty",
            cell: (r) => (
              <input
                type="number"
                min={0}
                step="1"
                disabled={readOnly}
                value={String(r.quantityDispatched)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDispatchItems((prev) =>
                    prev.map((di) =>
                      di.itemId === r.itemId ? { ...di, quantityDispatched: v } : di,
                    ),
                  );
                }}
                className="h-9 w-28 rounded-md bg-white px-3 text-right text-sm text-stone-900 border border-stone-200 focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50"
              />
            ),
            className: "text-right w-36",
          },
        ]}
        emptyState="No dispatch items."
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm dispatch?"
        description="This will post OUTWARD stock ledger entries for the dispatched quantities."
        confirmLabel="Dispatch"
        onClose={() => {
          if (isMutating) return;
          setConfirmOpen(false);
        }}
        onConfirm={() => void onDispatch()}
      />
    </div>
  );
}

