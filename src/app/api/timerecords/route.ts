import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canEdit, canEditDepartment } from "@/lib/auth-utils";
import { loadHolidays, formatDateKey } from "@/lib/holidays";
import { logAudit } from "@/lib/audit";
import type { TimesheetRow, TimeRecordData } from "@/types";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth()));
  const departmentIdParam = searchParams.get("departmentId") ?? undefined;
  const employeeIdParam = searchParams.get("employeeId") ?? undefined;
  const effectiveDepartmentId = user.role === "MANAGER" ? (user.departmentId ?? undefined) : departmentIdParam;

  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const employees = await prisma.employee.findMany({
    where: {
      ...(employeeIdParam ? { id: employeeIdParam } : { isActive: true }),
      ...(effectiveDepartmentId ? { departmentId: effectiveDepartmentId } : {}),
    },
    orderBy: [{ department: { name: "asc" } }, { fullName: "asc" }],
    select: {
      id: true, fullName: true, personnelNumber: true, departmentId: true,
      schedule: { select: { id: true, name: true, hoursPerDay: true } },
    },
  });

  const employeeIds = employees.map((e) => e.id);
  const timeRecords = await prisma.timeRecord.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: startDate, lte: endDate } },
    include: { markType: true },
    orderBy: { slot: "asc" },
  });

  const holidays = await loadHolidays();
  const holidaysInMonth: Record<string, { name: string; isShortened: boolean }> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const key = formatDateKey(year, month, d);
    const holiday = holidays.get(key);
    if (holiday) holidaysInMonth[key] = holiday;
  }

  const workHoursSetting = await prisma.appSettings.findUnique({ where: { key: "work_hours_per_day" } });
  const defaultWorkHours = workHoursSetting ? parseFloat(workHoursSetting.value) : 8;

  const markTypes = await prisma.markType.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, defaultHours: true, color: true },
  });

  const rows: TimesheetRow[] = employees.map((emp) => {
    const empRecords = timeRecords.filter((r) => r.employeeId === emp.id);
    const records: Record<number, TimeRecordData> = {};
    const secondaryRecords: Record<number, TimeRecordData> = {};
    // Store defaultHours per day/slot to avoid O(n²) .find() in the second pass
    const defaultHoursMap: Record<number, { primary?: number; secondary?: number }> = {};
    let totalDays = 0, totalHours = 0, totalOvertimeHours = 0;
    const schedHours = emp.schedule?.hoursPerDay ?? defaultWorkHours;

    for (const rec of empRecords) {
      const day = rec.date.getUTCDate();
      // Формируем дату по UTC-компонентам чтобы избежать смещения часового пояса
      const utcDateStr = `${rec.date.getUTCFullYear()}-${String(rec.date.getUTCMonth() + 1).padStart(2, "0")}-${String(rec.date.getUTCDate()).padStart(2, "0")}`;
      const recData: TimeRecordData = {
        employeeId: emp.id,
        date: utcDateStr,
        markTypeId: rec.markTypeId,
        markCode: rec.markType.code,
        markColor: rec.markType.color,
        overtimeHours: rec.overtimeHours,
        actualHours: rec.actualHours,
        slot: rec.slot,
      };
      defaultHoursMap[day] ??= {};
      if (rec.slot === 0) {
        records[day] = recData;
        defaultHoursMap[day].primary = rec.markType.defaultHours;
      } else {
        secondaryRecords[day] = recData;
        defaultHoursMap[day].secondary = rec.markType.defaultHours;
      }
      totalOvertimeHours += rec.overtimeHours;
    }

    // Compute hours per day; when both slots exist it's a split day (each half = schedHours/2)
    for (const dayKey of Object.keys(defaultHoursMap)) {
      const day = Number(dayKey);
      const primary = records[day];
      const secondary = secondaryRecords[day];
      const dh = defaultHoursMap[day];

      if (primary) {
        totalDays += 1;
        if (secondary) {
          // Split day: each slot contributes half; actualHours overrides if explicitly set
          const halfSched = schedHours / 2;
          const primaryHours = primary.actualHours ?? ((dh.primary ?? 0) > 0 ? halfSched : 0);
          const secondaryHours = secondary.actualHours ?? ((dh.secondary ?? 0) > 0 ? halfSched : 0);
          totalHours += primaryHours + secondaryHours;
        } else {
          // Full day — use actualHours if set, else schedule hours when mark counts attendance
          totalHours += primary.actualHours ?? ((dh.primary ?? 0) > 0 ? schedHours : 0);
        }
      } else if (secondary) {
        // Secondary-only (edge case): half day
        totalHours += secondary.actualHours ?? ((dh.secondary ?? 0) > 0 ? schedHours / 2 : 0);
      }
    }

    return {
      employee: { id: emp.id, fullName: emp.fullName, personnelNumber: emp.personnelNumber, schedule: emp.schedule ?? null },
      records, secondaryRecords, totalDays, totalHours, totalOvertimeHours,
    };
  });

  return NextResponse.json({ rows, markTypes, holidays: holidaysInMonth, daysInMonth });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { employeeId, date, markTypeId, slot = 0, overtimeHours = 0, actualHours = null } = body as {
    employeeId: string; date: string; markTypeId: string | null;
    slot?: number; overtimeHours?: number; actualHours?: number | null;
  };

  if (user.role === "MANAGER") {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } });
    if (!employee || !canEditDepartment(user.role, user.departmentId, employee.departmentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Нормализуем дату до UTC полночи
  const [y, m, d] = (date.split("T")[0]).split("-").map(Number);
  const recordDate = new Date(Date.UTC(y, m - 1, d));
  const dayStart = recordDate;
  const dayEnd = new Date(Date.UTC(y, m - 1, d + 1));

  // Получаем данные о сотруднике для лога аудита
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, personnelNumber: true, department: { select: { name: true } } },
  });

  if (markTypeId === null) {
    // Ищем с учётом возможного сдвига часового пояса (seed-данные хранятся как T21:00:00Z)
    const existing = await prisma.timeRecord.findFirst({
      where: { employeeId, date: { gte: dayStart, lt: dayEnd }, slot },
      include: { markType: true },
    });
    if (existing) {
      await prisma.timeRecord.delete({ where: { id: existing.id } });
    }
    await logAudit(user, "TIMERECORD", "DELETE", `${employeeId}:${date}:${slot}`, {
      employeeId,
      employeeName: emp?.fullName ?? "—",
      personnelNumber: emp?.personnelNumber ?? "—",
      departmentName: emp?.department?.name ?? "—",
      date,
      slot,
      markCode: existing?.markType.code ?? null,
      overtimeHours: existing?.overtimeHours ?? null,
      actualHours: existing?.actualHours ?? null,
    });
    return NextResponse.json({ deleted: true });
  }

  // Ищем существующую запись с учётом сдвига часового пояса
  const existingRecord = await prisma.timeRecord.findFirst({
    where: { employeeId, date: { gte: dayStart, lt: dayEnd }, slot },
    include: { markType: true },
  });

  let record;
  if (existingRecord) {
    record = await prisma.timeRecord.update({
      where: { id: existingRecord.id },
      data: { markTypeId, overtimeHours, actualHours },
      include: { markType: true },
    });
  } else {
    record = await prisma.timeRecord.create({
      data: { employeeId, date: recordDate, markTypeId, slot, overtimeHours, actualHours },
      include: { markType: true },
    });
  }

  const isCreate = existingRecord === null;
  await logAudit(user, "TIMERECORD", isCreate ? "CREATE" : "UPDATE", `${employeeId}:${date}:${slot}`, {
    employeeId,
    employeeName: emp?.fullName ?? "—",
    personnelNumber: emp?.personnelNumber ?? "—",
    departmentName: emp?.department?.name ?? "—",
    date,
    slot,
    markCode: record.markType.code,
    overtimeHours: record.overtimeHours,
    actualHours: record.actualHours,
    ...(isCreate ? {} : {
      before: {
        markCode: existingRecord.markType.code,
        overtimeHours: existingRecord.overtimeHours,
        actualHours: existingRecord.actualHours,
      },
    }),
  });

  return NextResponse.json({
    employeeId: record.employeeId,
    date: `${record.date.getUTCFullYear()}-${String(record.date.getUTCMonth() + 1).padStart(2, "0")}-${String(record.date.getUTCDate()).padStart(2, "0")}`,
    markTypeId: record.markTypeId,
    markCode: record.markType.code,
    markColor: record.markType.color,
    overtimeHours: record.overtimeHours,
    actualHours: record.actualHours,
    slot: record.slot,
  });
}