import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      schedule: { select: { hoursPerDay: true } },
      linkedEmployee: { select: { id: true, fullName: true, position: true, personnelNumber: true, department: { select: { name: true } }, schedule: { select: { hoursPerDay: true } } } },
      linkedBy: { select: { id: true, fullName: true, position: true, personnelNumber: true, department: { select: { name: true } }, schedule: { select: { hoursPerDay: true } } } },
    },
  });
  if (!employee) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });

  const schedHours = employee.schedule?.hoursPerDay ?? 8;

  const allRecords = await prisma.timeRecord.findMany({
    where: { employeeId: id },
    include: { markType: { select: { code: true, name: true, color: true, defaultHours: true } } },
    orderBy: [{ date: "desc" }, { slot: "asc" }],
  });

  // Only slot=0 records count as days; slot=1 is half-day addendum
  const primaryRecords = allRecords.filter((r) => r.slot === 0);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const currentMonthPrimary = primaryRecords.filter((r) => {
    const d = r.date;
    return d.getUTCFullYear() === currentYear && d.getUTCMonth() === currentMonth;
  });

  const currentMonthByCode: Record<string, number> = {};
  let currentMonthHours = 0;
  let currentMonthOT = 0;
  for (const r of currentMonthPrimary) {
    const code = r.markType.code;
    currentMonthByCode[code] = (currentMonthByCode[code] ?? 0) + 1;
    currentMonthHours += r.actualHours ?? schedHours;
    currentMonthOT += r.overtimeHours;
  }

  const allTimeByCode: Record<string, number> = {};
  let allTimeHours = 0;
  let allTimeOT = 0;
  for (const r of primaryRecords) {
    const code = r.markType.code;
    allTimeByCode[code] = (allTimeByCode[code] ?? 0) + 1;
    allTimeHours += r.actualHours ?? schedHours;
    allTimeOT += r.overtimeHours;
  }

  const firstRecord = primaryRecords.length > 0 ? primaryRecords[primaryRecords.length - 1] : null;
  const lastRecord = primaryRecords.length > 0 ? primaryRecords[0] : null;

  const recentRecords = primaryRecords.slice(0, 10).map((r) => ({
    date: r.date.toISOString().split("T")[0],
    markCode: r.markType.code,
    markColor: r.markType.color,
    markName: r.markType.name,
    hours: schedHours,
    overtimeHours: r.overtimeHours,
  }));

  // --- Суммарные часы совместителя ---
  // Deduplicate: linkedEmployee and linkedBy can both point to the same person
  const seenIds = new Set<string>();
  const linkedEntities = [
    ...(employee.linkedEmployee ? [employee.linkedEmployee] : []),
    ...(employee.linkedBy ?? []),
  ].filter((e) => { if (seenIds.has(e.id)) return false; seenIds.add(e.id); return true; });

  let combinedHours: number | null = null;
  let combinedOT: number | null = null;
  if (linkedEntities.length > 0) {
    const linkedIds = linkedEntities.map((e) => e.id);
    const linkedMonthRecords = await prisma.timeRecord.findMany({
      where: {
        employeeId: { in: linkedIds },
        slot: 0,
        date: {
          gte: new Date(Date.UTC(currentYear, currentMonth, 1)),
          lte: new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)),
        },
      },
    });
    combinedHours = currentMonthHours;
    combinedOT = currentMonthOT;
    for (const linked of linkedEntities) {
      const lh = linked.schedule?.hoursPerDay ?? 8;
      const lRecs = linkedMonthRecords.filter((r) => r.employeeId === linked.id);
      combinedHours += lRecs.length * lh;
      combinedOT += lRecs.reduce((s, r) => s + r.overtimeHours, 0);
    }
  }

  return NextResponse.json({
    currentMonth: {
      year: currentYear, month: currentMonth,
      byCode: currentMonthByCode,
      totalHours: currentMonthHours,
      totalOvertimeHours: currentMonthOT,
      totalRecords: currentMonthPrimary.length,
    },
    allTime: {
      totalRecords: primaryRecords.length,
      totalHours: allTimeHours,
      totalOvertimeHours: allTimeOT,
      byCode: allTimeByCode,
      firstRecordDate: firstRecord ? firstRecord.date.toISOString().split("T")[0] : null,
      lastRecordDate: lastRecord ? lastRecord.date.toISOString().split("T")[0] : null,
    },
    recentRecords,
    linked: linkedEntities.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      position: e.position,
      personnelNumber: e.personnelNumber,
      departmentName: e.department?.name ?? "",
    })),
    combinedHours,
    combinedOT,
  });
}