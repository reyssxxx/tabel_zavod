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

  const selectedDate = dateParam ? new Date(dateParam) : new Date();
  const selYear = selectedDate.getUTCFullYear();
  const selMonth = selectedDate.getUTCMonth();
  const selDay = selectedDate.getUTCDate();

  const now = new Date();
  const year = selYear;
  const month = selMonth;
  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  const dayStart = new Date(Date.UTC(selYear, selMonth, selDay));
  const dayEnd = new Date(Date.UTC(selYear, selMonth, selDay + 1));

  const departmentFilter =
    user.role === "MANAGER" && user.departmentId
      ? { departmentId: user.departmentId }
      : {};

  const deptCountFilter =
    user.role === "MANAGER" && user.departmentId
      ? { id: user.departmentId }
      : undefined;

  const [totalEmployees, totalDepartments, timeRecords, dayRecords, departments, allEmployees, holidays] =
    await Promise.all([
      prisma.employee.count({ where: { isActive: true, ...departmentFilter } }),
      prisma.department.count({ where: deptCountFilter }),
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
  let businessTripDaysTotal = 0;
  let shortenedDaysTotal = 0;

  for (const rec of timeRecords) {
    switch (rec.markType.code) {
      case "Я":  workDaysTotal++;         break;
      case "ОТ": vacationDaysTotal++;     break;
      case "Б":  sickDaysTotal++;         break;
      case "П":  absentDaysTotal++;       break;
      case "К":  businessTripDaysTotal++; break;
      case "С":  shortenedDaysTotal++;    break;
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
      case "Я":  todayPresent++;  break;
      case "ОТ": todayVacation++; break;
      case "Б":  todaySick++;     break;
      case "П":  todayAbsent++;   break;
    }
  }
  const todayUnmarked = totalEmployees - dayMarkedEmployees.size;

  // Dept rates
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

  // Daily chart
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

  // === Заполненность табеля (fillRate) ===
  const workdaysInMonth = countWorkdaysUntil(year, month, refDate, holidays);
  const expectedRecords = totalEmployees * workdaysInMonth;
  const actualRecords = workDaysTotal + vacationDaysTotal + sickDaysTotal + absentDaysTotal + businessTripDaysTotal + shortenedDaysTotal;
  const fillRate = expectedRecords > 0 ? Math.round((actualRecords / expectedRecords) * 100) : 0;

  // === Аномалии ===
  type Anomaly = { type: string; count: number; label: string };
  const anomalies: Anomaly[] = [];

  // Тип 1: сотрудники с 3+ прогулами за месяц
  const absentByEmp = new Map<string, number>();
  for (const rec of timeRecords) {
    if (rec.markType.code === "П") {
      absentByEmp.set(rec.employeeId, (absentByEmp.get(rec.employeeId) ?? 0) + 1);
    }
  }
  const manyAbsentCount = Array.from(absentByEmp.values()).filter((c) => c >= 3).length;
  if (manyAbsentCount > 0) {
    anomalies.push({ type: "many_absences", count: manyAbsentCount, label: "сотрудников с 3+ прогулами в этом месяце" });
  }

  // Тип 2: длительный больничный (7+ дней за месяц)
  const sickByEmp = new Map<string, number>();
  for (const rec of timeRecords) {
    if (rec.markType.code === "Б") {
      sickByEmp.set(rec.employeeId, (sickByEmp.get(rec.employeeId) ?? 0) + 1);
    }
  }
  const longSickCount = Array.from(sickByEmp.values()).filter((c) => c >= 7).length;
  if (longSickCount > 0) {
    anomalies.push({ type: "long_sick", count: longSickCount, label: "сотрудников на длительном больничном (7+ дней)" });
  }

  // Тип 3: сотрудники совсем без отметок за месяц
  const markedThisMonth = new Set(timeRecords.map((r) => r.employeeId));
  const noRecordsCount = allEmployees.filter((e) => !markedThisMonth.has(e.id)).length;
  if (noRecordsCount > 0) {
    anomalies.push({ type: "no_records", count: noRecordsCount, label: "сотрудников без отметок в этом месяце" });
  }

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
    businessTripDaysTotal,
    todayPresent,
    todayVacation,
    todaySick,
    todayAbsent,
    todayUnmarked,
    worstDept,
    bestDept,
    dailyChart,
    fillRate,
    anomalies,
    isToday,
    selectedDate: `${selYear}-${String(selMonth + 1).padStart(2, "0")}-${String(selDay).padStart(2, "0")}`,
  });
}
