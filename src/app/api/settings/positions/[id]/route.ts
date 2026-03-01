import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";

function handleAuthError(err: unknown): NextResponse | null {
  if (err instanceof Error && err.message === "Unauthorized")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (err instanceof Error && err.message === "Forbidden")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");

    const { id } = await params;
    const body = await request.json();
    const name = (body.name as string | undefined)?.trim() ?? "";
    const baseSalary = Number(body.baseSalary);

    if (!name) return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
    if (!isFinite(baseSalary) || baseSalary < 0)
      return NextResponse.json({ error: "Некорректный оклад" }, { status: 400 });

    try {
      const position = await prisma.position.update({
        where: { id },
        data: { name, baseSalary },
        include: { _count: { select: { employees: true } } },
      });
      return NextResponse.json({ id: position.id, name: position.name, baseSalary: position.baseSalary, employeeCount: position._count.employees });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("P2002") || msg.includes("Unique constraint")) {
        return NextResponse.json({ error: "Должность с таким названием уже существует" }, { status: 400 });
      }
      if (msg.includes("P2025") || msg.includes("Record to update not found")) {
        return NextResponse.json({ error: "Должность не найдена" }, { status: 404 });
      }
      return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
    }
  } catch (err) {
    return handleAuthError(err) ?? NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");

    const { id } = await params;

    const empCount = await prisma.employee.count({ where: { positionId: id } });
    if (empCount > 0) {
      return NextResponse.json({ error: "Нельзя удалить должность, к которой привязаны сотрудники" }, { status: 400 });
    }

    await prisma.position.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleAuthError(err) ?? NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
