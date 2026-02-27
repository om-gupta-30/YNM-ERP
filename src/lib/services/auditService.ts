import type { AuditLogEntry, FactoryCode } from "@/lib/types";
import { dbAuditService } from "@/lib/dbServices/auditService";

export type AuditService = {
  logAudit: (input: {
    userId?: string;
    user: string;
    action: string;
    module: string;
    entityId?: string;
    entityType?: string;
    details?: Record<string, unknown>;
    factory?: FactoryCode;
  }) => Promise<void>;
  getAuditLogs: (params?: {
    delayMs?: number;
    factory?: FactoryCode;
    module?: string;
    action?: string;
    userId?: string;
    limit?: number;
  }) => Promise<AuditLogEntry[]>;
  getAuditModules: () => Promise<string[]>;
};

export const auditService: AuditService = {
  async logAudit(input) {
    await dbAuditService.insertLog({
      userId: input.userId ?? "",
      userName: input.user,
      action: input.action,
      module: input.module,
      entityId: input.entityId,
      entityType: input.entityType,
      details: input.details,
      factory: input.factory,
    });
  },

  async getAuditLogs(params) {
    return dbAuditService.getLogs({
      factory: params?.factory,
      module: params?.module,
      action: params?.action,
      userId: params?.userId,
      limit: params?.limit,
    });
  },

  async getAuditModules() {
    return dbAuditService.getModules();
  },
};
