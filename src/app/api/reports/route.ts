import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";
import { loadHolidays, isWeekend, formatDateKey } from "@/lib/holidays";
import type { ReportData } from "@/types";

/**
 * Считает рабочие дни с 1-го числа до указанной даты (включительно).
 * Выходные (сб/вс) и праздники (isShortened=false) — не рабочие.
 * Сокращённые дни (isShortened=true) — рабочие (просто короче).
 */
function countWorkdaysUntil(
  year: number,
  month: number,
  untilDate: Date,
  holidays: Map<string, { name: string; isShortened: boolean }>
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lastDay =
    untilDate.getFullYear() === year && untilDate.getMonth() === month
      ? Math.min(daysInMonth, untilDate.getDate())
      : daysInMonth;

  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month, d);
    const key = formatDateKey(year, month, d);
    const holiday = holidays.get(key);
    if (!isWeekend(date) && (!holiday || holiday.isShortened)) {
      count++;
    }
  }
  return count;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth()));
  const departmentIdParam = searchParams.get("departmentId") ?? "all";

  if (isNaN(year) || isNaN(month)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  // MANAGER видит только своё подразделение
  const effectiveDeptId =
    user.role === "MANAGER"
      ? (user.departmentId ?? undefined)
      : departmentIdParam === "all"
      ? undefined
      : departmentIdParam;

  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  // Рабочие дни: для прошлых месяцев — весь месяц, для текущего — до сегодня
  const holidays = await loadHolidays();
  const today = new Date();
  const effectiveUntil = endDate < today ? endDate : today;
  const workdaysInPeriod = countWorkdaysUntil(year, month, effectiveUntil, holidays);

  // Получаем подразделения
  const departments = await prisma.department.findMany({
    where: effectiveDeptId ? { id: effectiveDeptId } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (departments.length === 0) {
    return NextResponse.json({ reports: [] });
  }

  const deptIds = departments.map((d) => d.id);

  // Получаем активных сотрудников
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      departmentId: { in: deptIds },
    },
    select: { id: true, departmentId: true },
  });

  const employeeIds = employees.map((e) => e.id);

  // Получаем записи за период (включаем defaultHours для расчёта часов)
  const timeRecords =
    employeeIds.length > 0
      ? await prisma.timeRecord.findMany({
          where: {
            employeeId: { in: employeeIds },
            date: { gte: startDate, lte: endDate },
          },
          include: { markType: { select: { code: true, defaultHours: true } } },
        })
      : [];

  // Агрегируем по подразделениям
  const empsByDept = new Map<string, string[]>();
  for (const emp of employees) {
    const list = empsByDept.get(emp.departmentId) ?? [];
    list.push(emp.id);
    empsByDept.set(emp.departmentId, list);
  }

  const recordsByEmpId = new Map<string, typeof timeRecords>();
  for (const rec of timeRecords) {
    const list = recordsByEmpId.get(rec.employeeId) ?? [];
    list.push(rec);
    recordsByEmpId.set(rec.employeeId, list);
  }

  const reports: ReportData[] = departments.map((dept) => {
    const deptEmpIds = empsByDept.get(dept.id) ?? [];
    const deptRecords = deptEmpIds.flatMap((id) => recordsByEmpId.get(id) ?? []);
    const totalEmployees = deptEmpIds.length;

    const workRecords = deptRecords.filter((r) => r.markType.code === "Я");
    const workDays = workRecords.length;
    const totalWorkHours = workRecords.reduce((s, r) => s + r.markType.defaultHours, 0);

    const denominator = totalEmployees * workdaysInPeriod;
    const attendanceRate =
      denominator > 0 ? Math.round((workDays / denominator) * 1000) / 10 : 0;
    const unmarkedDays = Math.max(0, denominator - deptRecords.length);

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      totalEmployees,
      workDays,
      vacationDays: deptRecords.filter((r) => r.markType.code === "ОТ").length,
      sickDays: deptRecords.filter((r) => r.markType.code === "Б").length,
      businessTripDays: deptRecords.filter((r) => r.markType.code === "К").length,
      absentDays: deptRecords.filter((r) => r.markType.code === "П").length,
      shortenedDays: deptRecords.filter((r) => r.markType.code === "С").length,
      totalWorkHours,
      attendanceRate,
      workdaysInPeriod,
      unmarkedDays,
    };
  });

  return NextResponse.json({ reports });
}
