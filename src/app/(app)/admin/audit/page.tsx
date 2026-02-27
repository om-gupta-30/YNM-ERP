"use client";

import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, TableSkeleton } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TablePagination } from "@/components/ui/TablePagination";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { auditService } from "@/lib/services";
import type { AuditLogEntry } from "@/lib/types";
import { useTableSort } from "@/lib/hooks/useTableSort";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATE: "bg-sky-50 text-sky-700 border-sky-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
  APPROVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECT: "bg-red-50 text-red-700 border-red-200",
  SUBMIT: "bg-amber-50 text-amber-700 border-amber-200",
  STATUS_CHANGE: "bg-stone-50 text-stone-700 border-stone-200",
  LOGIN: "bg-sky-50 text-sky-700 border-sky-200",
  LOGOUT: "bg-stone-50 text-stone-500 border-stone-200",
};

function ActionBadge({ action }: { action: string }) {
  const tone = ACTION_COLORS[action] ?? "bg-stone-50 text-stone-600 border-stone-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${tone}`}>
      {action}
    </span>
  );
}

function formatTimestamp(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AuditLogPage() {
  const { currentUser, role, factory } = useAuth();
  const canView = can.viewAudit(role);

  const [isLoading, setIsLoading] = React.useState(true);
  const [modules, setModules] = React.useState<string[]>(["ALL"]);
  const [moduleFilter, setModuleFilter] = React.useState("ALL");
  const [actionFilter, setActionFilter] = React.useState("ALL");
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [rows, setRows] = React.useState<AuditLogEntry[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const refresh = React.useCallback(async () => {
    if (!factory) return;
    setIsLoading(true);
    setError(null);
    try {
      const [mods, logs] = await Promise.all([
        auditService.getAuditModules(),
        auditService.getAuditLogs({
          factory,
          module: moduleFilter,
          action: actionFilter !== "ALL" ? actionFilter : undefined,
          limit: 500,
        }),
      ]);
      setModules(mods);
      setRows(logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs.");
    } finally {
      setIsLoading(false);
    }
  }, [factory, moduleFilter, actionFilter]);

  React.useEffect(() => {
    if (!canView) return;
    void refresh();
  }, [canView, refresh]);

  const filtered = React.useMemo(() => {
    if (!debouncedSearch) return rows;
    const q = debouncedSearch.toLowerCase();
    return rows.filter(
      (r) =>
        r.user.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        r.module.toLowerCase().includes(q) ||
        (r.entityType ?? "").toLowerCase().includes(q) ||
        (r.entityId ?? "").toLowerCase().includes(q),
    );
  }, [rows, debouncedSearch]);

  const getSortValue = React.useCallback((row: AuditLogEntry, key: string) => {
    if (key === "time") return row.timestamp;
    if (key === "user") return row.user;
    if (key === "action") return row.action;
    if (key === "module") return row.module;
    return "";
  }, []);

  const { sortConfig, onSort, sorted } = useTableSort(filtered, getSortValue);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  React.useEffect(() => setPage(1), [debouncedSearch, moduleFilter, actionFilter]);

  if (!currentUser) return <AccessDenied title="Sign in required" message="Please sign in to view audit logs." />;
  if (!canView) return <AccessDenied title="Admin only" message="Only admins can view audit logs." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Log"
        description="Immutable activity trail across all ERP modules."
        hint="Every action taken in the system is recorded here. Use the filters to find specific events."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={isLoading}>
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="ds-alert-error">{error}</div>
      ) : null}

      {/* Filters */}
      <div className="ds-filter-bar">
        <div className="flex flex-wrap items-end gap-3">
          <div className="ds-field min-w-[200px] flex-1">
            <label className="ds-label">Search</label>
            <input
              type="text"
              className="ds-input"
              placeholder="Search user, action, module, entity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ds-field">
            <label className="ds-label">Module</label>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="ds-select w-[160px]"
            >
              {modules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="ds-field">
            <label className="ds-label">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="ds-select w-[150px]"
            >
              <option value="ALL">All</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="APPROVE">Approve</option>
              <option value="REJECT">Reject</option>
              <option value="SUBMIT">Submit</option>
              <option value="STATUS_CHANGE">Status Change</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : (
        <DataTable
          rows={paged}
          sortConfig={sortConfig}
          onSort={onSort}
          emptyState="No audit logs match your filters."
          columns={[
            {
              header: "Time",
              sortKey: "time",
              cell: (r) => (
                <div className="whitespace-nowrap font-mono text-xs text-stone-500">
                  {formatTimestamp(r.timestamp)}
                </div>
              ),
            },
            {
              header: "User",
              sortKey: "user",
              cell: (r) => <div className="font-medium text-stone-800">{r.user}</div>,
            },
            {
              header: "Action",
              sortKey: "action",
              cell: (r) => <ActionBadge action={r.action} />,
            },
            {
              header: "Module",
              sortKey: "module",
              cell: (r) => <StatusBadge value={r.module} />,
            },
            {
              header: "Entity",
              cell: (r) => (
                r.entityType ? (
                  <div>
                    <span className="text-xs font-medium text-stone-600">{r.entityType}</span>
                    {r.entityId ? (
                      <span className="ml-1.5 font-mono text-[11px] text-stone-400">{r.entityId.slice(0, 8)}…</span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-stone-300">—</span>
                )
              ),
            },
            {
              header: "Details",
              cell: (r) => {
                if (!r.details || Object.keys(r.details).length === 0) {
                  return <span className="text-stone-300">—</span>;
                }
                const entries = Object.entries(r.details).slice(0, 3);
                return (
                  <div className="max-w-[260px] truncate text-xs text-stone-500">
                    {entries.map(([k, v]) => `${k}: ${String(v)}`).join(", ")}
                  </div>
                );
              },
            },
          ]}
        />
      )}

      {/* Pagination */}
      {!isLoading && sorted.length > 0 ? (
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalItems={sorted.length}
          pageSize={pageSize}
          visibleCount={paged.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          pageSizeOptions={[20, 50, 100]}
        />
      ) : null}
    </div>
  );
}
