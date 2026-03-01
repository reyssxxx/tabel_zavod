import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/auth-utils";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let currentUser;
  try {
    currentUser = await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const name = (body.name ?? "").trim();
  const role = (body.role ?? "").trim();
  const departmentId = body.departmentId || null;
  const password = (body.password ?? "").trim();

  if (!name || !role) {
    return NextResponse.json({ error: "Имя и роль обязательны" }, { status: 400 });
  }

  const validRoles = ["ADMIN", "MANAGER", "ACCOUNTANT", "HR"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Неверная роль" }, { status: 400 });
  }

  // Нельзя сменить роль самому себе
  if (currentUser.id === id && currentUser.role !== role) {
    return NextResponse.json({ error: "Нельзя изменить роль своей учётной записи" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { name, role, departmentId };
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
  }

  try {
    await prisma.user.update({ where: { id }, data: updateData });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let currentUser;
  try {
    currentUser = await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (currentUser.id === id) {
    return NextResponse.json({ error: "Нельзя удалить собственную учётную запись" }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
    throw e;
  }
}
