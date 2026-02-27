import type { AuditLogEntry, FactoryCode } from "@/lib/types";
import { getClient, getFactoryId, getFactoryCode, nowIso } from "./_helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEntry(row: Record<string, any>): AuditLogEntry {
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? "",
    user: (row.user_name as string) ?? "",
    action: (row.action as string) ?? "",
    module: (row.module as string) ?? "",
    entityId: (row.entity_id as string) ?? undefined,
    entityType: (row.entity_type as string) ?? undefined,
    details: (row.details as Record<string, unknown>) ?? undefined,
    factory: undefined, // populated below if factory_id exists
    timestamp: (row.created_at as string) ?? nowIso(),
  };
}

export const dbAuditService = {
  async insertLog(input: {
    userId: string;
    userName: string;
    action: string;
    module: string;
    entityId?: string;
    entityType?: string;
    details?: Record<string, unknown>;
    factory?: FactoryCode;
  }): Promise<void> {
    const factoryId = input.factory ? await getFactoryId(input.factory) : null;
    const { error } = await getClient()
      .from("audit_logs")
      .insert({
        user_id: input.userId,
        user_name: input.userName,
        action: input.action,
        module: input.module,
        entity_id: input.entityId ?? null,
        entity_type: input.entityType ?? null,
        details: input.details ?? {},
        factory_id: factoryId,
      });
    if (error) {
      console.error("[AuditLog] Failed to write audit entry:", error.message);
    }
  },

  async getLogs(params?: {
    factory?: FactoryCode;
    module?: string;
    action?: string;
    userId?: string;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    let query = getClient()
      .from("audit_logs")
      .select("id, user_id, user_name, action, module, entity_id, entity_type, details, factory_id, created_at")
      .order("created_at", { ascending: false })
      .limit(params?.limit ?? 200);

    if (params?.factory) {
      const factoryId = await getFactoryId(params.factory);
      if (factoryId) query = query.eq("factory_id", factoryId);
    }
    if (params?.module && params.module !== "ALL") {
      query = query.eq("module", params.module);
    }
    if (params?.action) {
      query = query.eq("action", params.action);
    }
    if (params?.userId) {
      query = query.eq("user_id", params.userId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[AuditLog] Failed to read audit logs:", error.message);
      return [];
    }

    const entries: AuditLogEntry[] = [];
    for (const row of data ?? []) {
      const entry = toEntry(row);
      entry.factory = await getFactoryCode(row.factory_id as string | null);
      entries.push(entry);
    }
    return entries;
  },

  async getModules(): Promise<string[]> {
    const { data, error } = await getClient()
      .from("audit_logs")
      .select("module")
      .limit(1000);

    if (error) {
      console.error("[AuditLog] Failed to read audit modules:", error.message);
      return ["ALL"];
    }

    const set = new Set<string>();
    for (const row of data ?? []) {
      if (row.module) set.add(row.module as string);
    }
    return ["ALL", ...Array.from(set).sort()];
  },
};
