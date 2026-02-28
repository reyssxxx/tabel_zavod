import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, canEditDepartment } from "@/lib/auth-utils";

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: employeeInclude,
    });

    if (!employee) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireRole("ADMIN", "MANAGER");

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { departmentId: true, personnelNumber: true, linkedEmployeeId: true },
    });

    if (!employee) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    if (!canEditDepartment(user.role, user.departmentId, employee.departmentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      fullName,
      position,
      departmentId,
      personnelNumber,
      isActive,
      scheduleId,
      linkedEmployeeId,
    } = body as {
      fullName?: string;
      position?: string;
      departmentId?: string;
      personnelNumber?: string;
      isActive?: boolean;
      scheduleId?: string | null;
      linkedEmployeeId?: string | null;
    };

    if (departmentId && !canEditDepartment(user.role, user.departmentId, departmentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (personnelNumber && personnelNumber.trim() !== employee.personnelNumber) {
      const existing = await prisma.employee.findUnique({
        where: { personnelNumber: personnelNumber.trim() },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Табельный номер ${personnelNumber} уже занят` },
          { status: 400 }
        );
      }
    }

    // Bidirectional link handling in transaction
    const newLinkedId = linkedEmployeeId !== undefined ? (linkedEmployeeId || null) : undefined;
    const oldLinkedId = employee.linkedEmployeeId;

    const updated = await prisma.$transaction(async (tx) => {
      // Remove old reverse link if linkedEmployeeId is changing
      if (newLinkedId !== undefined && oldLinkedId && oldLinkedId !== newLinkedId) {
        await tx.employee.update({
          where: { id: oldLinkedId },
          data: { linkedEmployeeId: null },
        });
      }
      // Set new reverse link
      if (newLinkedId) {
        await tx.employee.update({
          where: { id: newLinkedId },
          data: { linkedEmployeeId: id },
        });
      }
      return tx.employee.update({
        where: { id },
        data: {
          ...(fullName !== undefined ? { fullName: fullName.trim() } : {}),
          ...(position !== undefined ? { position: position.trim() } : {}),
          ...(departmentId !== undefined ? { departmentId } : {}),
          ...(personnelNumber !== undefined ? { personnelNumber: personnelNumber.trim() } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(scheduleId !== undefined ? { scheduleId: scheduleId || null } : {}),
          ...(newLinkedId !== undefined ? { linkedEmployeeId: newLinkedId } : {}),
        },
        include: employeeInclude,
      });
    });

    return NextResponse.json(updated);
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireRole("ADMIN", "MANAGER");

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { departmentId: true, isActive: true },
    });

    if (!employee) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    if (!canEditDepartment(user.role, user.departmentId, employee.departmentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
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
