import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  }

  try {
    const department = await prisma.department.update({
      where: { id },
      data: { name },
    });
    return NextResponse.json(department);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e) {
      const code = (e as { code: string }).code;
      if (code === "P2002") {
        return NextResponse.json(
          { error: "Подразделение с таким названием уже существует" },
          { status: 400 }
        );
      }
      if (code === "P2025") {
        return NextResponse.json({ error: "Не найдено" }, { status: 404 });
      }
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const activeCount = await prisma.employee.count({
    where: { departmentId: id, isActive: true },
  });

  if (activeCount > 0) {
    return NextResponse.json(
      { error: "Нельзя удалить подразделение, в котором есть активные сотрудники" },
      { status: 400 }
    );
  }

  try {
    await prisma.department.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    }
    throw e;
  }
}
