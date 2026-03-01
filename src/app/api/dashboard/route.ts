import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";
import { MONTHS } from "@/lib/constants";
import { loadHolidays, isWeekend, formatDateKey } from "@/lib/holidays";

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
    if (!isWeekend(date) && (!holiday || holiday.isShortened)) count++;
  }
  return count;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  // Если передана дата — используем её, иначе сегодня
  const selectedDate = dateParam ? new Date(dateParam) : new Date();
  // Нормализуем до полуночи локального времени через UTC
  const selYear = selectedDate.getUTCFullYear();
  const selMonth = selectedDate.getUTCMonth();
  const selDay = selectedDate.getUTCDate();

  const now = new Date();
  const year = selYear;
  const month = selMonth;
  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  // Выбранный день (range)
  const dayStart = new Date(Date.UTC(selYear, selMonth, selDay));
  const dayEnd = new Date(Date.UTC(selYear, selMonth, selDay + 1));

  const departmentFilter =
    user.role === "MANAGER" && user.departmentId
      ? { departmentId: user.departmentId }
      : {};

  const [totalEmployees, totalDepartments, timeRecords, dayRecords, departments, allEmployees, holidays] =
    await Promise.all([
      prisma.employee.count({ where: { isActive: true, ...departmentFilter } }),
      prisma.department.count(),
      prisma.timeRecord.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          employee: { isActive: true, ...departmentFilter },
        },
        select: { employeeId: true, date: true, markType: { select: { code: true } } },
      }),
      prisma.timeRecord.findMany({
        where: {
          date: { gte: dayStart, lt: dayEnd },
          employee: { isActive: true, ...departmentFilter },
        },
        select: { employeeId: true, markType: { select: { code: true } } },
      }),
      prisma.department.findMany({ select: { id: true, name: true } }),
      prisma.employee.findMany({
        where: { isActive: true, ...departmentFilter },
        select: { id: true, departmentId: true },
      }),
      loadHolidays(),
    ]);

  // Month totals
  let workDaysTotal = 0;
  let vacationDaysTotal = 0;
  let sickDaysTotal = 0;
  let absentDaysTotal = 0;

  for (const rec of timeRecords) {
    switch (rec.markType.code) {
      case "Я": workDaysTotal++; break;
      case "ОТ": vacationDaysTotal++; break;
      case "Б": sickDaysTotal++; break;
      case "П": absentDaysTotal++; break;
    }
  }

  // Selected day stats
  let todayPresent = 0;
  let todayVacation = 0;
  let todaySick = 0;
  let todayAbsent = 0;
  const dayMarkedEmployees = new Set<string>();
  for (const rec of dayRecords) {
    dayMarkedEmployees.add(rec.employeeId);
    switch (rec.markType.code) {
      case "Я": todayPresent++; break;
      case "ОТ": todayVacation++; break;
      case "Б": todaySick++; break;
      case "П": todayAbsent++; break;
    }
  }
  const todayUnmarked = totalEmployees - dayMarkedEmployees.size;

  // Per-department attendance rate for month-to-selected-day
  const refDate = new Date(selYear, selMonth, selDay);
  const workdaysInPeriod = countWorkdaysUntil(year, month, refDate, holidays);

  const deptEmployees = new Map<string, string[]>();
  for (const emp of allEmployees) {
    const arr = deptEmployees.get(emp.departmentId) ?? [];
    arr.push(emp.id);
    deptEmployees.set(emp.departmentId, arr);
  }

  const empDept = new Map<string, string>();
  for (const emp of allEmployees) {
    empDept.set(emp.id, emp.departmentId);
  }

  const deptWorkDays = new Map<string, number>();
  for (const rec of timeRecords) {
    if (rec.markType.code === "Я") {
      const deptId = empDept.get(rec.employeeId);
      if (deptId) deptWorkDays.set(deptId, (deptWorkDays.get(deptId) ?? 0) + 1);
    }
  }

  type DeptRate = { id: string; name: string; rate: number; employeeCount: number };
  const deptRates: DeptRate[] = [];

  for (const dept of departments) {
    const empIds = deptEmployees.get(dept.id) ?? [];
    const empCount = empIds.length;
    if (empCount === 0) continue;
    const wdCount = deptWorkDays.get(dept.id) ?? 0;
    const denominator = empCount * workdaysInPeriod;
    const rate = denominator > 0 ? Math.round((wdCount / denominator) * 1000) / 10 : 0;
    deptRates.push({ id: dept.id, name: dept.name, rate, employeeCount: empCount });
  }

  deptRates.sort((a, b) => a.rate - b.rate);
  const worstDept = deptRates.length > 0 ? deptRates[0] : null;
  const bestDept = deptRates.length > 1 ? deptRates[deptRates.length - 1] : null;

  // Daily chart: sick (Б) and absent (П) counts per calendar day up to selected day
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const chartLastDay = Math.min(selDay, daysInMonth);
  const dailySick = new Array<number>(chartLastDay).fill(0);
  const dailyAbsent = new Array<number>(chartLastDay).fill(0);
  for (const rec of timeRecords) {
    const d = rec.date.getUTCDate();
    if (d >= 1 && d <= chartLastDay) {
      if (rec.markType.code === "Б") dailySick[d - 1]++;
      if (rec.markType.code === "П") dailyAbsent[d - 1]++;
    }
  }
  const dailyChart = Array.from({ length: chartLastDay }, (_, i) => ({
    day: i + 1,
    sick: dailySick[i],
    absent: dailyAbsent[i],
  }));

  // Является ли выбранная дата "сегодня"
  const isToday =
    selYear === now.getFullYear() &&
    selMonth === now.getMonth() &&
    selDay === now.getDate();

  return NextResponse.json({
    totalEmployees,
    totalDepartments,
    currentMonth: `${MONTHS[month]} ${year}`,
    workDaysTotal,
    vacationDaysTotal,
    sickDaysTotal,
    absentDaysTotal,
    todayPresent,
    todayVacation,
    todaySick,
    todayAbsent,
    todayUnmarked,
    worstDept,
    bestDept,
    dailyChart,
    isToday,
    selectedDate: `${selYear}-${String(selMonth + 1).padStart(2, "0")}-${String(selDay).padStart(2, "0")}`,
  });
}
