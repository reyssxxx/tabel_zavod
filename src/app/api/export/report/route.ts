import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";
import { loadHolidays, isWeekend, formatDateKey } from "@/lib/holidays";
import { generateReportTxt } from "@/lib/export";
import { calculateSalary, getNormWorkdays, getExperienceYears, DEFAULT_OT_COEF_1, DEFAULT_OT_COEF_2, DEFAULT_OT_THRESHOLD, DEFAULT_WEEKEND_COEF, DEFAULT_HOLIDAY_COEF } from "@/lib/salary";
import type { ReportData } from "@/types";

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
  const year = parseInt(searchParams.get("year") ?? "");
  const month = parseInt(searchParams.get("month") ?? "");
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

  const holidays = await loadHolidays();
  const today = new Date();
  const effectiveUntil = endDate < today ? endDate : today;
  const workdaysInPeriod = countWorkdaysUntil(year, month, effectiveUntil, holidays);
  const normWorkdays = getNormWorkdays(year, month, holidays);

  // OT коэффициенты
  async function getAppSetting(key: string, defaultVal: number): Promise<number> {
    const row = await prisma.appSettings.findUnique({ where: { key } });
    if (!row) return defaultVal;
    const v = parseFloat(row.value);
    return isFinite(v) ? v : defaultVal;
  }
  const [otCoef1, otCoef2, otThreshold, weekendCoef, holidayCoef] = await Promise.all([
    getAppSetting("ot_coef_1", DEFAULT_OT_COEF_1),
    getAppSetting("ot_coef_2", DEFAULT_OT_COEF_2),
    getAppSetting("ot_threshold", DEFAULT_OT_THRESHOLD),
    getAppSetting("weekend_coef", DEFAULT_WEEKEND_COEF),
    getAppSetting("holiday_coef", DEFAULT_HOLIDAY_COEF),
  ]);

  // Получаем подразделения
  const departments = await prisma.department.findMany({
    where: effectiveDeptId ? { id: effectiveDeptId } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const deptIds = departments.map((d) => d.id);

  const employees =
    deptIds.length > 0
      ? await prisma.employee.findMany({
          where: {
            isActive: true,
            departmentId: { in: deptIds },
          },
          select: {
            id: true,
            departmentId: true,
            schedule: { select: { hoursPerDay: true } },
            positionRef: { select: { baseSalary: true } },
            hireDate: true,
          },
        })
      : [];

  const employeeIds = employees.map((e) => e.id);

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

  // Агрегируем
  const empById = new Map(employees.map((e) => [e.id, e]));
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
    const deptRecords = deptEmpIds.flatMap((id) => (recordsByEmpId.get(id) ?? []).filter((r) => r.slot === 0));
    const totalEmployees = deptEmpIds.length;

    const workRecords = deptRecords.filter((r) => r.markType.code === "Я");
    const workDays = workRecords.length;
    const totalWorkHours = workRecords.reduce((s, r) => {
      const schedHours = empById.get(r.employeeId)?.schedule?.hoursPerDay ?? 8;
      return s + (r.actualHours ?? schedHours);
    }, 0);

    const denominator = totalEmployees * workdaysInPeriod;
    const attendanceRate =
      denominator > 0 ? Math.round((workDays / denominator) * 1000) / 10 : 0;
    const unmarkedDays = Math.max(0, denominator - deptRecords.length);

    // Расчёт ФОТ
    let totalSalary = 0;
    let salaryEmployeeCount = 0;
    for (const empId of deptEmpIds) {
      const emp = empById.get(empId);
      if (!emp?.positionRef?.baseSalary) continue;
      salaryEmployeeCount++;
      const hoursPerDay = emp.schedule?.hoursPerDay ?? 8;
      const normHours = normWorkdays * hoursPerDay;
      const empRecs = (recordsByEmpId.get(empId) ?? []).filter((r) => r.slot === 0);
      let workedHours = 0;
      let weekendHours = 0;
      let holidayHours = 0;
      let otHours = 0;
      let sickDays = 0;
      let vacationDays = 0;
      for (const rec of empRecs) {
        if (rec.markType.code === "Б") { sickDays++; otHours += rec.overtimeHours; continue; }
        if (rec.markType.code === "ОТ") { vacationDays++; otHours += rec.overtimeHours; continue; }
        if (rec.markType.defaultHours <= 0) { otHours += rec.overtimeHours; continue; }
        const effectiveHours = rec.actualHours ?? hoursPerDay;
        otHours += rec.overtimeHours;
        const d = rec.date;
        const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
        const dateObj = new Date(y, m, day);
        const dateKey = formatDateKey(y, m, day);
        const holiday = holidays.get(dateKey);
        if (holiday && !holiday.isShortened) holidayHours += effectiveHours;
        else if (isWeekend(dateObj)) weekendHours += effectiveHours;
        else workedHours += effectiveHours;
      }
      const periodStart = new Date(year, month, 1);
      const experienceYears = emp.hireDate ? getExperienceYears(emp.hireDate, periodStart) : 0;
      const bd = calculateSalary({ baseSalary: emp.positionRef.baseSalary, normHours, normDays: normWorkdays, workedHours, otHours, weekendHours, holidayHours, sickDays, vacationDays, experienceYears, otCoef1, otCoef2, otThreshold, weekendCoef, holidayCoef });
      totalSalary += bd.totalPay;
    }
    const avgSalary = salaryEmployeeCount > 0 ? totalSalary / salaryEmployeeCount : 0;

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
      totalSalary,
      avgSalary,
      salaryEmployeeCount,
    };
  });

  const txt = generateReportTxt(reports, month, year);
  const monthNum = month + 1;

  return new NextResponse(txt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="report_${monthNum}_${year}.txt"`,
    },
  });
}
