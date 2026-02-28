import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireRole, canEditDepartment } from "@/lib/auth-utils";

const employeeInclude = {
  department: { select: { id: true, name: true } },
  schedule: { select: { id: true, name: true, hoursPerDay: true } },
  linkedEmployee: {
    select: { id: true, fullName: true, department: { select: { name: true } } },
  },
  linkedBy: {
    select: { id: true, fullName: true, department: { select: { name: true } } },
  },
} as const;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") ?? "";
  const departmentParam = searchParams.get("department") ?? "";
  const showInactive = searchParams.get("showInactive") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") ?? "20"));

  const effectiveDepartmentId =
    user.role === "MANAGER"
      ? (user.departmentId ?? "")
      : departmentParam;

  const where = {
    ...(showInactive ? {} : { isActive: true }),
    ...(effectiveDepartmentId ? { departmentId: effectiveDepartmentId } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search } },
            { personnelNumber: { contains: search } },
          ],
        }
      : {}),
  };

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: [{ department: { name: "asc" } }, { fullName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  return NextResponse.json({ employees, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN", "MANAGER");

    const body = await request.json();
    const { fullName, position, departmentId, personnelNumber, scheduleId, linkedEmployeeId } =
      body as {
        fullName: string;
        position: string;
        departmentId: string;
        personnelNumber: string;
        scheduleId?: string | null;
        linkedEmployeeId?: string | null;
      };

    if (!fullName?.trim() || !position?.trim() || !departmentId || !personnelNumber?.trim()) {
      return NextResponse.json(
        { error: "Заполните все обязательные поля" },
        { status: 400 }
      );
    }

    if (!canEditDepartment(user.role, user.departmentId, departmentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.employee.findUnique({
      where: { personnelNumber: personnelNumber.trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Табельный номер ${personnelNumber} уже занят` },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        fullName: fullName.trim(),
        position: position.trim(),
        departmentId,
        personnelNumber: personnelNumber.trim(),
        scheduleId: scheduleId || null,
        linkedEmployeeId: linkedEmployeeId || null,
      },
      include: employeeInclude,
    });

    if (linkedEmployeeId) {
      await prisma.employee.update({
        where: { id: linkedEmployeeId },
        data: { linkedEmployeeId: employee.id },
      });
    }

    return NextResponse.json(employee, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
