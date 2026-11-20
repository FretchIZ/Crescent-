import { db } from "./db";
import { clientIp } from "./api";
import { hashIp } from "./auth/session";

/**
 * Append-only audit trail for security-relevant events.
 * Failures are logged but never break the user-facing request.
 */
export type AuditEvent = {
  /** Who performed the action (signed-in user id, or null for guests/system). */
  actorId?: string | null;
  /** Legacy alias for actorId. */
  userId?: string | null;
  action: string;
  /** What the action targeted (e.g. "User", "Booking", "Review"). */
  entityType?: string;
  entityId?: string;
  /** Legacy aliases for entityType/entityId. */
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  /** When supplied, the client IP is derived and stored hashed. */
  request?: Request;
  ip?: string | null;
};

export async function audit(event: AuditEvent): Promise<void> {
  try {
    const ip = event.ip ?? (event.request ? clientIp(event.request) : null);
    await db.auditLog.create({
      data: {
        userId: event.actorId ?? event.userId ?? null,
        action: event.action,
        entityType: event.entityType ?? event.targetType ?? null,
        entityId: event.entityId ?? event.targetId ?? null,
        metadata: JSON.stringify(event.metadata ?? {}),
        ipHash: ip ? hashIp(ip) : null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}
