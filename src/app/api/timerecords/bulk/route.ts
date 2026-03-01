import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canEdit, canEditDepartment } from "@/lib/auth-utils";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { entries } = body as {
    entries: Array<{ employeeId: string; date: string; markTypeId: string | null; slot?: number; overtimeHours?: number }>;
  };

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "entries required" }, { status: 400 });
  }

  // Для MANAGER: проверяем все сотрудники из его подразделения
  if (user.role === "MANAGER") {
    const uniqueEmployeeIds = [...new Set(entries.map((e) => e.employeeId))];
    const employees = await prisma.employee.findMany({
      where: { id: { in: uniqueEmployeeIds } },
      select: { id: true, departmentId: true },
    });
    const empMap = new Map(employees.map((e) => [e.id, e.departmentId]));
    for (const empId of uniqueEmployeeIds) {
      const deptId = empMap.get(empId);
      if (!deptId || !canEditDepartment(user.role, user.departmentId, deptId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  let updated = 0;
  for (const entry of entries) {
    // Нормализуем дату до UTC полночи: берём только YYYY-MM-DD часть
    const [y, m, d] = (entry.date.split("T")[0]).split("-").map(Number);
    const recordDate = new Date(Date.UTC(y, m - 1, d));
    const slot = entry.slot ?? 0;

    // Ищем существующую запись с учётом возможного сдвига часового пояса в seed-данных
    const dayStart = new Date(Date.UTC(y, m - 1, d));
    const dayEnd = new Date(Date.UTC(y, m - 1, d + 1));
    const existing = await prisma.timeRecord.findFirst({
      where: { employeeId: entry.employeeId, date: { gte: dayStart, lt: dayEnd }, slot },
      select: { id: true, date: true },
    });

    if (entry.markTypeId === null) {
      // Очистка ячейки
      if (existing) {
        await prisma.timeRecord.delete({ where: { id: existing.id } });
        updated++;
      }
    } else {
      const overtimeHours = entry.overtimeHours ?? 0;
      if (existing) {
        await prisma.timeRecord.update({
          where: { id: existing.id },
          data: { markTypeId: entry.markTypeId, overtimeHours },
        });
      } else {
        await prisma.timeRecord.create({
          data: { employeeId: entry.employeeId, date: recordDate, markTypeId: entry.markTypeId, slot, overtimeHours },
        });
      }
      updated++;
    }
  }

  // Одна запись аудита на весь bulk-запрос
  const uniqueEmployeeIds = [...new Set(entries.map((e) => e.employeeId))];
  const empDetails = await prisma.employee.findMany({
    where: { id: { in: uniqueEmployeeIds } },
    select: { id: true, fullName: true, personnelNumber: true },
  });
  const sortedDates = entries.map((e) => e.date).sort();
  const nonNullMarkTypeIds = [...new Set(entries.map((e) => e.markTypeId).filter(Boolean))] as string[];
  const markTypes = nonNullMarkTypeIds.length > 0
    ? await prisma.markType.findMany({ where: { id: { in: nonNullMarkTypeIds } }, select: { code: true } })
    : [];
  const isClear = entries.every((e) => e.markTypeId === null);
  await logAudit(user, "TIMERECORD", isClear ? "DELETE" : "UPDATE", "BULK", {
    count: updated,
    employees: empDetails.map((e) => ({ id: e.id, name: e.fullName, personnelNumber: e.personnelNumber })),
    dateRange: { from: sortedDates[0], to: sortedDates[sortedDates.length - 1] },
    markCodes: isClear ? ["(очистка)"] : markTypes.map((m) => m.code),
  });

  return NextResponse.json({ updated });
}
