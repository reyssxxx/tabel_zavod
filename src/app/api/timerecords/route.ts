import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canEdit, canEditDepartment } from "@/lib/auth-utils";
import { loadHolidays, formatDateKey, isWeekend } from "@/lib/holidays";
import type { TimesheetRow, TimeRecordData } from "@/types";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth()));
  const departmentIdParam = searchParams.get("departmentId") ?? undefined;

  // MANAGER видит только своё подразделение
  const effectiveDepartmentId =
    user.role === "MANAGER" ? (user.departmentId ?? undefined) : departmentIdParam;

  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Получаем сотрудников
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(effectiveDepartmentId ? { departmentId: effectiveDepartmentId } : {}),
    },
    orderBy: [{ department: { name: "asc" } }, { fullName: "asc" }],
    select: {
      id: true,
      fullName: true,
      personnelNumber: true,
      departmentId: true,
    },
  });

  const employeeIds = employees.map((e) => e.id);

  // Получаем записи за период
  const timeRecords = await prisma.timeRecord.findMany({
    where: {
      employeeId: { in: employeeIds },
      date: { gte: startDate, lte: endDate },
    },
    include: { markType: true },
  });

  // Получаем праздники
  const holidays = await loadHolidays();
  const holidaysInMonth: Record<string, { name: string; isShortened: boolean }> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const key = formatDateKey(year, month, d);
    const holiday = holidays.get(key);
    if (holiday) {
      holidaysInMonth[key] = holiday;
    }
  }

  // Получаем все типы отметок
  const markTypes = await prisma.markType.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, defaultHours: true, color: true },
  });

  // Формируем строки табеля
  const rows: TimesheetRow[] = employees.map((emp) => {
    const empRecords = timeRecords.filter((r) => r.employeeId === emp.id);
    const records: Record<number, TimeRecordData> = {};

    let totalDays = 0;
    let totalHours = 0;

    for (const rec of empRecords) {
      const day = rec.date.getUTCDate();
      records[day] = {
        employeeId: emp.id,
        date: rec.date.toISOString().split("T")[0],
        markTypeId: rec.markTypeId,
        markCode: rec.markType.code,
        markColor: rec.markType.color,
      };
      totalDays += 1;
      totalHours += rec.markType.defaultHours;
    }

    return {
      employee: {
        id: emp.id,
        fullName: emp.fullName,
        personnelNumber: emp.personnelNumber,
      },
      records,
      totalDays,
      totalHours,
    };
  });

  return NextResponse.json({ rows, markTypes, holidays: holidaysInMonth, daysInMonth });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canEdit(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { employeeId, date, markTypeId } = body as {
    employeeId: string;
    date: string;
    markTypeId: string | null;
  };

  // Для MANAGER: проверяем что сотрудник из его подразделения
  if (user.role === "MANAGER") {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { departmentId: true },
    });
    if (!employee || !canEditDepartment(user.role, user.departmentId, employee.departmentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const recordDate = new Date(date);

  if (markTypeId === null) {
    // Удаляем запись
    await prisma.timeRecord.deleteMany({
      where: { employeeId, date: recordDate },
    });
    return NextResponse.json({ deleted: true });
  }

  // Upsert запись
  const record = await prisma.timeRecord.upsert({
    where: { employeeId_date_slot: { employeeId, date: recordDate, slot: 0 } },
    update: { markTypeId },
    create: { employeeId, date: recordDate, markTypeId, slot: 0 },
    include: { markType: true },
  });

  return NextResponse.json({
    employeeId: record.employeeId,
    date: record.date.toISOString().split("T")[0],
    markTypeId: record.markTypeId,
    markCode: record.markType.code,
    markColor: record.markType.color,
  });
}
