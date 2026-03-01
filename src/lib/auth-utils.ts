import { auth } from "./auth";
import type { Role, SessionUser } from "@/types";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const user = session.user as Record<string, unknown>;
  return {
    id: user.id as string,
    name: user.name as string,
    email: user.email as string,
    role: user.role as Role,
    departmentId: (user.departmentId as string) ?? null,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

export function canEditDepartment(
  userRole: Role,
  userDepartmentId: string | null,
  targetDepartmentId: string
): boolean {
  if (userRole === "ADMIN" || userRole === "HR") return true;
  if (userRole === "ACCOUNTANT") return false;
  if (userRole === "MANAGER") {
    return userDepartmentId === targetDepartmentId;
  }
  return false;
}

export function canEdit(userRole: Role): boolean {
  return userRole === "ADMIN" || userRole === "MANAGER" || userRole === "HR";
}

export function canCreateEmployee(userRole: Role): boolean {
  return userRole === "ADMIN" || userRole === "HR";
}
