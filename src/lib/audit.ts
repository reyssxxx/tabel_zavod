import { prisma } from "@/lib/db";

export type AuditEntityType = "TIMERECORD" | "EMPLOYEE" | "EMPLOYEE_IMPORT";
export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditUser {
  id: string;
  name: string;
  role: string;
}

export async function logAudit(
  user: AuditUser,
  entityType: AuditEntityType,
  action: AuditAction,
  entityId: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType,
        action,
        entityId,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: JSON.stringify(details),
      },
    });
  } catch (err) {
    // Ошибка аудита никогда не должна ломать основную операцию
    console.error("[audit] Failed to write audit log:", err);
  }
}
