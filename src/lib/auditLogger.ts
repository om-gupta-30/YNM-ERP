import type { AuditAction, AuditModule, FactoryCode } from "@/lib/types";
import { dbAuditService } from "@/lib/dbServices/auditService";

type AuditPayload = {
  userId: string;
  userName: string;
  action: AuditAction;
  module: AuditModule;
  entityId?: string;
  entityType?: string;
  details?: Record<string, unknown>;
  factory?: FactoryCode;
};

const queue: AuditPayload[] = [];
let flushing = false;

async function flush() {
  if (flushing) return;
  flushing = true;
  while (queue.length > 0) {
    const batch = queue.splice(0, 10);
    await Promise.allSettled(batch.map((p) => dbAuditService.insertLog(p)));
  }
  flushing = false;
}

/**
 * Fire-and-forget audit logger. Enqueues the entry and flushes asynchronously
 * so the calling operation is never blocked by audit writes.
 */
export function logAudit(payload: AuditPayload): void {
  queue.push(payload);
  void flush();
}

/**
 * Convenience wrapper that partially applies user context. Use in service
 * functions where user info is available from the caller.
 */
export function createAuditContext(user: { id: string; name: string; factory?: FactoryCode }) {
  return function log(
    action: AuditAction,
    module: AuditModule,
    opts?: { entityId?: string; entityType?: string; details?: Record<string, unknown> },
  ) {
    logAudit({
      userId: user.id,
      userName: user.name,
      action,
      module,
      factory: user.factory,
      ...opts,
    });
  };
}
