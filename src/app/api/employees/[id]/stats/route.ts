import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  }

  // Все записи сотрудника, отсортированные по убыванию даты
  const allRecords = await prisma.timeRecord.findMany({
    where: { employeeId: id },
    include: {
      markType: {
        select: { code: true, name: true, color: true, defaultHours: true },
      },
    },
    orderBy: { date: "desc" },
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // --- Текущий месяц ---
  const currentMonthRecords = allRecords.filter((r) => {
    const d = r.date;
    return d.getUTCFullYear() === currentYear && d.getUTCMonth() === currentMonth;
  });

  const currentMonthByCode: Record<string, number> = {};
  let currentMonthHours = 0;
  for (const r of currentMonthRecords) {
    const code = r.markType.code;
    currentMonthByCode[code] = (currentMonthByCode[code] ?? 0) + 1;
    currentMonthHours += r.markType.defaultHours;
  }

  // --- За всё время ---
  const allTimeByCode: Record<string, number> = {};
  let allTimeHours = 0;
  for (const r of allRecords) {
    const code = r.markType.code;
    allTimeByCode[code] = (allTimeByCode[code] ?? 0) + 1;
    allTimeHours += r.markType.defaultHours;
  }

  const firstRecord = allRecords.length > 0 ? allRecords[allRecords.length - 1] : null;
  const lastRecord = allRecords.length > 0 ? allRecords[0] : null;

  // --- Последние 10 записей ---
  const recentRecords = allRecords.slice(0, 10).map((r) => ({
    date: r.date.toISOString().split("T")[0],
    markCode: r.markType.code,
    markColor: r.markType.color,
    markName: r.markType.name,
    hours: r.markType.defaultHours,
  }));

  return NextResponse.json({
    currentMonth: {
      year: currentYear,
      month: currentMonth,
      byCode: currentMonthByCode,
      totalHours: currentMonthHours,
      totalRecords: currentMonthRecords.length,
    },
    allTime: {
      totalRecords: allRecords.length,
      totalHours: allTimeHours,
      byCode: allTimeByCode,
      firstRecordDate: firstRecord ? firstRecord.date.toISOString().split("T")[0] : null,
      lastRecordDate: lastRecord ? lastRecord.date.toISOString().split("T")[0] : null,
    },
    recentRecords,
  });
}
