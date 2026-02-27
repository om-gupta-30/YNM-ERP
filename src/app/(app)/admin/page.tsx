/* Logic correction:
   This page previously relied only on sidebar role filtering.
   Direct navigation to `/admin` would still render for unauthorized users. */
"use client";

import * as React from "react";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { User } from "@/lib/types";
import { userService } from "@/lib/services";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { can } from "@/lib/rbac";
import { useTableSort } from "@/lib/hooks/useTableSort";

export default function AdminPage() {
  const { currentUser, role } = useAuth();
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!currentUser || !can.viewAdmin(role)) {
      setUsers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    userService
      .getUsers()
      .then((u) => setUsers(u))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users."))
      .finally(() => setIsLoading(false));
  }, [currentUser, role]);

  const getSortValue = React.useCallback((row: User, key: string) => {
    if (key === "name") return row.name;
    if (key === "email") return row.email;
    if (key === "role") return row.role;
    return "";
  }, []);

  const { sortConfig, onSort, sorted } = useTableSort(users, getSortValue);

  if (!currentUser) {
    return <AccessDenied title="Sign in required" message="Please sign in to view admin." />;
  }
  if (!can.viewAdmin(role)) {
    return <AccessDenied title="Admin only" message="Only admins can access this page." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Administration (dummy data; frontend-only role filtering)."
      />

      {error ? (
        <div className="ds-alert-error">
          {error}
        </div>
      ) : null}

      <DataTable
        rows={sorted}
        sortConfig={sortConfig}
        onSort={onSort}
        emptyState={isLoading ? "Loading…" : "No users."}
        columns={[
          { header: "Name", accessor: "name", sortKey: "name" },
          { header: "Email", accessor: "email", sortKey: "email" },
          { header: "Role", accessor: "role", sortKey: "role" },
          { header: "Factory", accessor: "factory" },
          {
            header: "Status",
            cell: (r) => <StatusBadge value={r.isActive ? "Active" : "Inactive"} />,
          },
        ]}
      />
    </div>
  );
}

