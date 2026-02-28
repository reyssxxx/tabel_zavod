import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canEdit, canEditDepartment } from "@/lib/auth-utils";

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
    entries: Array<{ employeeId: string; date: string; markTypeId: string }>;
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
    const recordDate = new Date(entry.date);
    await prisma.timeRecord.upsert({
      where: { employeeId_date_slot: { employeeId: entry.employeeId, date: recordDate, slot: 0 } },
      update: { markTypeId: entry.markTypeId },
      create: {
        employeeId: entry.employeeId,
        date: recordDate,
        markTypeId: entry.markTypeId,
      },
    });
    updated++;
  }

  return NextResponse.json({ updated });
}
