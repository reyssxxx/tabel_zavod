import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";
import { MONTHS } from "@/lib/constants";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  // MANAGER видит только своё подразделение
  const departmentFilter =
    user.role === "MANAGER" && user.departmentId
      ? { departmentId: user.departmentId }
      : {};

  const [totalEmployees, totalDepartments, timeRecords] = await Promise.all([
    prisma.employee.count({ where: { isActive: true, ...departmentFilter } }),
    prisma.department.count(),
    prisma.timeRecord.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        employee: { isActive: true, ...departmentFilter },
      },
      include: { markType: { select: { code: true } } },
    }),
  ]);

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

  return NextResponse.json({
    totalEmployees,
    totalDepartments,
    currentMonth: `${MONTHS[month]} ${year}`,
    workDaysTotal,
    vacationDaysTotal,
    sickDaysTotal,
    absentDaysTotal,
  });
}
