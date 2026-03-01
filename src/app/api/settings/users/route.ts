import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";

export async function GET() {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    include: { department: { select: { name: true } } },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      departmentId: u.departmentId,
      departmentName: u.department?.name ?? null,
    }))
  );
}

export async function POST(request: Request) {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const role = (body.role ?? "").trim();
  const password = (body.password ?? "").trim();
  const departmentId = body.departmentId || null;

  if (!email || !name || !role || !password) {
    return NextResponse.json({ error: "Заполните все обязательные поля" }, { status: 400 });
  }

  const validRoles = ["ADMIN", "MANAGER", "ACCOUNTANT", "HR"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Неверная роль" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { email, name, role, passwordHash, departmentId },
    });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Email уже занят" }, { status: 400 });
    }
    throw e;
  }
}
