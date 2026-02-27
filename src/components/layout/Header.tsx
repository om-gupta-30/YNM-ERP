"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { notificationService } from "@/lib/services/notificationService";

function titleFromPath(pathname: string) {
  if (pathname === "/dashboard") return "Home";
  if (pathname.startsWith("/dashboard/director")) return "Executive View";
  if (pathname.startsWith("/masters/items")) return "Items";
  if (pathname.startsWith("/masters/suppliers")) return "Suppliers";
  if (pathname.startsWith("/masters/customers")) return "Customers";
  if (pathname.startsWith("/masters/bom")) return "Bill of Materials";
  if (pathname.startsWith("/purchase/pr")) return "Purchase Requisition";
  if (pathname.startsWith("/purchase/rfq")) return "RFQ & Quotes";
  if (pathname.startsWith("/purchase/po")) return "Purchase Orders";
  if (pathname.startsWith("/inventory/gate-entry")) return "Gate Entry";
  if (pathname.startsWith("/inventory/grn")) return "GRN";
  if (pathname.startsWith("/inventory/stock")) return "Stock & Ledger";
  if (pathname.startsWith("/inventory/ledger")) return "Stock Ledger";
  if (pathname.startsWith("/production/work-orders")) return "Work Orders";
  if (pathname.startsWith("/production")) return "Production";
  if (pathname.startsWith("/sales")) return "Sales Orders";
  if (pathname.startsWith("/dispatch/invoice")) return "Invoices";
  if (pathname.startsWith("/dispatch")) return "Dispatch";
  if (pathname.startsWith("/approvals")) return "Approvals";
  if (pathname.startsWith("/admin")) return "Audit Log";
  return "YNM ERP";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Header(props: { onOpenSidebar: () => void }) {
  const pathname = usePathname();
  const { currentUser, role, factory, logout } = useAuth();
  const title = titleFromPath(pathname);

  const [avatarOpen, setAvatarOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifLoading, setNotifLoading] = React.useState(false);
  const [notifications, setNotifications] = React.useState<
    Array<{ id: string; title: string; message: string; severity: string; href?: string }>
  >([]);

  const avatarRef = React.useRef<HTMLDivElement>(null);
  const notifRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setAvatarOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    setNotifications([]);
    setNotifOpen(false);
  }, [role, factory]);

  React.useEffect(() => {
    if (!currentUser || !role || !factory || !notifOpen) return;
    let alive = true;
    setNotifLoading(true);
    notificationService
      .getNotifications({ role, factory })
      .then((list) => { if (alive) setNotifications(list); })
      .finally(() => { if (alive) setNotifLoading(false); });
    return () => { alive = false; };
  }, [currentUser, role, factory, notifOpen]);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/60 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={props.onOpenSidebar}
          className="inline-flex size-8 items-center justify-center rounded-lg text-stone-500 transition-all duration-200 hover:bg-stone-100 hover:text-stone-900 lg:hidden"
          aria-label="Open navigation"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Page title */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-stone-900">{title}</h1>
        </div>

        {/* Notification bell */}
        {currentUser && (
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => { setNotifOpen((v) => !v); setAvatarOpen(false); }}
              className="relative inline-flex size-8 items-center justify-center rounded-lg text-stone-500 transition-all duration-200 hover:bg-stone-100 hover:text-stone-900"
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {notifications.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-gold-500 px-1 py-0.5 text-[10px] font-semibold leading-none text-gold-950">
                  {notifications.length}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-10 w-[320px] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-200/50">
                <div className="border-b border-stone-100 px-4 py-2.5">
                  <div className="text-xs font-semibold text-stone-900">Notifications</div>
                  <div className="text-[11px] text-stone-400">{factory}</div>
                </div>
                <div className="max-h-[300px] overflow-auto">
                  {notifLoading ? (
                    <div className="px-4 py-4 text-sm text-stone-400">Loading...</div>
                  ) : notifications.length > 0 ? (
                    <div className="divide-y divide-stone-100">
                      {notifications.map((n) => (
                        <Link
                          key={n.id}
                          href={n.href ?? "#"}
                          className="block px-4 py-3 transition-colors duration-150 hover:bg-gold-50/50"
                          onClick={() => setNotifOpen(false)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-stone-900">{n.title}</div>
                              <div className="mt-0.5 text-xs text-stone-500">{n.message}</div>
                            </div>
                            <span
                              className={[
                                "mt-0.5 shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                n.severity === "critical"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : n.severity === "warning"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-stone-200 bg-stone-50 text-stone-600",
                              ].join(" ")}
                            >
                              {n.severity}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-sm text-stone-400">No notifications.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Avatar dropdown */}
        {currentUser ? (
          <div className="relative" ref={avatarRef}>
            <button
              type="button"
              onClick={() => { setAvatarOpen((v) => !v); setNotifOpen(false); }}
              className="inline-flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-[11px] font-bold text-gold-950 shadow-sm shadow-gold-500/20 transition-all duration-200 hover:shadow-md hover:shadow-gold-500/30 hover:ring-2 hover:ring-gold-300 hover:ring-offset-1"
              aria-label="User menu"
              aria-expanded={avatarOpen}
            >
              {getInitials(currentUser.name)}
            </button>

            {avatarOpen && (
              <div className="absolute right-0 top-10 w-[260px] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-200/50">
                {/* User info */}
                <div className="border-b border-stone-100 px-4 py-3">
                  <div className="text-sm font-semibold text-stone-900">{currentUser.name}</div>
                  <div className="mt-0.5 text-xs text-stone-400">{currentUser.email}</div>
                </div>

                {/* Role & Factory */}
                <div className="space-y-2 border-b border-stone-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">Role</span>
                    <span className="rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-medium capitalize text-gold-800 border border-gold-200">{role ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">Factory</span>
                    <span className="text-xs font-medium text-stone-700">{factory ?? "YNM-HYD"}</span>
                  </div>
                </div>

                {/* Logout */}
                <div className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-stone-600 transition-all duration-200 hover:bg-stone-50 hover:text-stone-900"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3h-9m9 0l-3-3m3 3l-3 3" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm transition-all duration-200 hover:bg-stone-50 hover:shadow-md"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
