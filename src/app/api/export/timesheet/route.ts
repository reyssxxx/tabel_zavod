import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";
import { generateTimesheetXlsx, generateTimesheetCsv } from "@/lib/export";
import { loadHolidays, formatDateKey } from "@/lib/holidays";
import type { TimesheetRow, TimeRecordData } from "@/types"; // TimeRecordData used in local mapping

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? "");
  const month = parseInt(searchParams.get("month") ?? "");
  const departmentIdParam = searchParams.get("departmentId") ?? "all";
  const format = searchParams.get("format") as "xlsx" | "csv" | null;

  if (isNaN(year) || isNaN(month) || !format) {
    return NextResponse.json({ error: "Missing or invalid params" }, { status: 400 });
  }

  if (format !== "xlsx" && format !== "csv") {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  // MANAGER видит только своё подразделение
  const effectiveDeptId =
    user.role === "MANAGER"
      ? (user.departmentId ?? undefined)
      : departmentIdParam === "all"
      ? undefined
      : departmentIdParam;

  // Получаем название подразделения для заголовка xlsx
  let departmentName = "Все подразделения";
  if (effectiveDeptId) {
    const dept = await prisma.department.findUnique({
      where: { id: effectiveDeptId },
      select: { name: true },
    });
    if (dept) departmentName = dept.name;
  }

  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(effectiveDeptId ? { departmentId: effectiveDeptId } : {}),
    },
    orderBy: [{ department: { name: "asc" } }, { fullName: "asc" }],
    select: {
      id: true,
      fullName: true,
      personnelNumber: true,
      schedule: { select: { id: true, name: true, hoursPerDay: true } },
    },
  });

  const employeeIds = employees.map((e) => e.id);

  const timeRecords =
    employeeIds.length > 0
      ? await prisma.timeRecord.findMany({
          where: {
            employeeId: { in: employeeIds },
            date: { gte: startDate, lte: endDate },
          },
          include: { markType: true },
          orderBy: { slot: "asc" },
        })
      : [];

  const rows: TimesheetRow[] = employees.map((emp) => {
    const empRecords = timeRecords.filter((r) => r.employeeId === emp.id);
    const records: Record<number, TimeRecordData> = {};
    const secondaryRecords: Record<number, TimeRecordData> = {};
    let totalDays = 0, totalHours = 0, totalOvertimeHours = 0;

    for (const rec of empRecords) {
      const day = rec.date.getUTCDate();
      const schedHours = emp.schedule?.hoursPerDay ?? rec.markType.defaultHours;
      const recData: TimeRecordData = {
        employeeId: emp.id,
        date: rec.date.toISOString().split("T")[0],
        markTypeId: rec.markTypeId,
        markCode: rec.markType.code,
        markColor: rec.markType.color,
        overtimeHours: rec.overtimeHours,
        actualHours: rec.actualHours,
        slot: rec.slot,
      };
      if (rec.slot === 0) {
        records[day] = recData;
        totalDays += 1;
        totalHours += rec.actualHours ?? schedHours;
      } else {
        secondaryRecords[day] = recData;
      }
      totalOvertimeHours += rec.overtimeHours;
    }

    return {
      employee: { id: emp.id, fullName: emp.fullName, personnelNumber: emp.personnelNumber, schedule: emp.schedule ?? null },
      records, secondaryRecords, totalDays, totalHours, totalOvertimeHours,
    };
  });

  const monthNum = month + 1;

  if (format === "xlsx") {
    // Загружаем праздники и формируем map для месяца
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const allHolidays = await loadHolidays();
    const holidaysInMonth: Record<string, { name: string; isShortened: boolean }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const key = formatDateKey(year, month, d);
      const h = allHolidays.get(key);
      if (h) holidaysInMonth[key] = h;
    }
    const buffer = generateTimesheetXlsx(rows, month, year, departmentName, holidaysInMonth);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tabel_${monthNum}_${year}.xlsx"`,
      },
    });
  } else {
    const csv = generateTimesheetCsv(rows, month, year);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tabel_${monthNum}_${year}.csv"`,
      },
    });
  }
}
