import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";
import { loadHolidays, isWeekend, formatDateKey } from "@/lib/holidays";
import {
  calculateSalary,
  getNormWorkdays,
  getExperienceYears,
  DEFAULT_OT_COEF_1,
  DEFAULT_OT_COEF_2,
  DEFAULT_OT_THRESHOLD,
  DEFAULT_WEEKEND_COEF,
  DEFAULT_HOLIDAY_COEF,
} from "@/lib/salary";

export interface EmployeeReportRow {
  employeeId: string;
  fullName: string;
  personnelNumber: string;
  position: string;
  workDays: number;
  vacationDays: number;
  sickDays: number;
  absentDays: number;
  businessTripDays: number;
  totalHours: number;
  totalSalary: number | null;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth()));
  const departmentId = searchParams.get("departmentId");

  if (isNaN(year) || isNaN(month) || !departmentId) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  // MANAGER can only see their own department
  if (user.role === "MANAGER" && user.departmentId && user.departmentId !== departmentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  const holidays = await loadHolidays();
  const today = new Date();
  const effectiveUntil = endDate < today ? endDate : today;

  function countWorkdaysUntil(untilDate: Date): number {
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

  const workdaysInPeriod = countWorkdaysUntil(effectiveUntil);
  const normWorkdays = getNormWorkdays(year, month, holidays);

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

  const employees = await prisma.employee.findMany({
    where: { isActive: true, departmentId },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      personnelNumber: true,
      position: true,
      hireDate: true,
      schedule: { select: { hoursPerDay: true } },
      positionRef: { select: { baseSalary: true } },
    },
  });

  const employeeIds = employees.map((e) => e.id);

  const timeRecords =
    employeeIds.length > 0
      ? await prisma.timeRecord.findMany({
          where: {
            employeeId: { in: employeeIds },
            date: { gte: startDate, lte: endDate },
            slot: 0,
          },
          include: { markType: { select: { code: true, defaultHours: true } } },
        })
      : [];

  const recordsByEmpId = new Map<string, typeof timeRecords>();
  for (const rec of timeRecords) {
    const list = recordsByEmpId.get(rec.employeeId) ?? [];
    list.push(rec);
    recordsByEmpId.set(rec.employeeId, list);
  }

  const rows: EmployeeReportRow[] = employees.map((emp) => {
    const empRecs = recordsByEmpId.get(emp.id) ?? [];

    let workDays = 0;
    let vacationDays = 0;
    let sickDays = 0;
    let absentDays = 0;
    let businessTripDays = 0;
    let totalHours = 0;

    const hoursPerDay = emp.schedule?.hoursPerDay ?? 8;

    let workedHours = 0;
    let weekendHours = 0;
    let holidayHours = 0;
    let otHours = 0;

    for (const rec of empRecs) {
      otHours += rec.overtimeHours;
      switch (rec.markType.code) {
        case "Я": {
          workDays++;
          const effectiveHours = rec.actualHours ?? hoursPerDay;
          totalHours += effectiveHours;
          const d = rec.date;
          const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
          const dateObj = new Date(y, m, day);
          const dateKey = formatDateKey(y, m, day);
          const holiday = holidays.get(dateKey);
          if (holiday && !holiday.isShortened) holidayHours += effectiveHours;
          else if (isWeekend(dateObj)) weekendHours += effectiveHours;
          else workedHours += effectiveHours;
          break;
        }
        case "ОТ": vacationDays++; break;
        case "Б":  sickDays++;     break;
        case "П":  absentDays++;   break;
        case "К":  businessTripDays++; break;
      }
    }

    let totalSalary: number | null = null;
    if (emp.positionRef?.baseSalary) {
      const normHours = normWorkdays * hoursPerDay;
      const periodStart = new Date(year, month, 1);
      const experienceYears = emp.hireDate ? getExperienceYears(emp.hireDate, periodStart) : 0;
      const bd = calculateSalary({
        baseSalary: emp.positionRef.baseSalary,
        normHours,
        normDays: normWorkdays,
        workedHours,
        otHours,
        weekendHours,
        holidayHours,
        sickDays,
        vacationDays,
        experienceYears,
        otCoef1,
        otCoef2,
        otThreshold,
        weekendCoef,
        holidayCoef,
      });
      totalSalary = bd.totalPay;
    }

    return {
      employeeId: emp.id,
      fullName: emp.fullName,
      personnelNumber: emp.personnelNumber,
      position: emp.position,
      workDays,
      vacationDays,
      sickDays,
      absentDays,
      businessTripDays,
      totalHours,
      totalSalary,
    };
  });

  return NextResponse.json({ rows, workdaysInPeriod });
}
