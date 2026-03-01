import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";
import { loadHolidays, isWeekend, formatDateKey } from "@/lib/holidays";
import {
  calculateSalary, getNormWorkdays, getExperienceYears,
  DEFAULT_OT_COEF_1, DEFAULT_OT_COEF_2, DEFAULT_OT_THRESHOLD,
  DEFAULT_WEEKEND_COEF, DEFAULT_HOLIDAY_COEF,
} from "@/lib/salary";

async function getAppSetting(key: string, defaultVal: number): Promise<number> {
  const row = await prisma.appSettings.findUnique({ where: { key } });
  if (!row) return defaultVal;
  const v = parseFloat(row.value);
  return isFinite(v) ? v : defaultVal;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth()));

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      positionRef: { select: { id: true, name: true, baseSalary: true } },
      schedule: { select: { hoursPerDay: true } },
      hireDate: true,
    },
  });

  if (!employee) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });

  if (!employee.positionRef) {
    return NextResponse.json({
      hasSalary: false,
      baseSalary: 0, normHours: 0, workedHours: 0, otHours: 0,
      weekendHours: 0, holidayHours: 0, sickDays: 0, sickPayRate: 0,
      vacationDays: 0, avgDailyRate: 0, experienceYears: 0,
      hourlyRate: 0, regularPay: 0, otPay: 0, weekendPay: 0, holidayPay: 0,
      sickPay: 0, vacationPay: 0, totalPay: 0,
    });
  }

  const hoursPerDay = employee.schedule?.hoursPerDay ?? 8;
  const holidays = await loadHolidays();
  const normWorkdays = getNormWorkdays(year, month, holidays);
  const normHours = normWorkdays * hoursPerDay;

  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  const records = await prisma.timeRecord.findMany({
    where: { employeeId: id, slot: 0, date: { gte: startDate, lte: endDate } },
    include: { markType: { select: { defaultHours: true, code: true } } },
  });

  // Стаж на первый день месяца (для однозначности)
  const periodStart = new Date(year, month, 1);
  const experienceYears = employee.hireDate
    ? getExperienceYears(employee.hireDate, periodStart)
    : 0;

  let workedHours = 0;
  let weekendHours = 0;
  let holidayHours = 0;
  let otHours = 0;
  let sickDays = 0;
  let vacationDays = 0;

  for (const rec of records) {
    if (rec.markType.code === "Б") {
      sickDays++;
      otHours += rec.overtimeHours;
      continue;
    }
    if (rec.markType.code === "ОТ") {
      vacationDays++;
      otHours += rec.overtimeHours;
      continue;
    }
    if (rec.markType.defaultHours <= 0) {
      // Other non-attendance (absent, etc.) — skip hours
      otHours += rec.overtimeHours;
      continue;
    }
    const effectiveHours = rec.actualHours ?? hoursPerDay;
    otHours += rec.overtimeHours;

    // Classify the day
    const d = rec.date;
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    const dateObj = new Date(y, m, day);
    const dateKey = formatDateKey(y, m, day);
    const holiday = holidays.get(dateKey);

    if (holiday && !holiday.isShortened) {
      // Non-shortened holiday — full holiday rate
      holidayHours += effectiveHours;
    } else if (isWeekend(dateObj)) {
      // Saturday or Sunday
      weekendHours += effectiveHours;
    } else {
      // Normal workday (including shortened holidays — paid at normal rate)
      workedHours += effectiveHours;
    }
  }

  const [otCoef1, otCoef2, otThreshold, weekendCoef, holidayCoef] = await Promise.all([
    getAppSetting("ot_coef_1", DEFAULT_OT_COEF_1),
    getAppSetting("ot_coef_2", DEFAULT_OT_COEF_2),
    getAppSetting("ot_threshold", DEFAULT_OT_THRESHOLD),
    getAppSetting("weekend_coef", DEFAULT_WEEKEND_COEF),
    getAppSetting("holiday_coef", DEFAULT_HOLIDAY_COEF),
  ]);

  const breakdown = calculateSalary({
    baseSalary: employee.positionRef.baseSalary,
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

  return NextResponse.json({
    ...breakdown,
    positionName: employee.positionRef.name,
    normWorkdays,
    hoursPerDay,
    year,
    month,
    otCoef1,
    otCoef2,
    otThreshold,
    weekendCoef,
    holidayCoef,
  });
}
