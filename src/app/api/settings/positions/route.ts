import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireRole } from "@/lib/auth-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const positions = await prisma.position.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });

  return NextResponse.json(
    positions.map((p) => ({
      id: p.id,
      name: p.name,
      baseSalary: p.baseSalary,
      employeeCount: p._count.employees,
    }))
  );
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");

    const body = await request.json();
    const name = (body.name as string | undefined)?.trim() ?? "";
    const baseSalary = Number(body.baseSalary);

    if (!name) return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
    if (!isFinite(baseSalary) || baseSalary < 0)
      return NextResponse.json({ error: "Некорректный оклад" }, { status: 400 });

    try {
      const position = await prisma.position.create({ data: { name, baseSalary } });
      return NextResponse.json({ id: position.id, name: position.name, baseSalary: position.baseSalary, employeeCount: 0 }, { status: 201 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("P2002") || msg.includes("Unique constraint")) {
        return NextResponse.json({ error: "Должность с таким названием уже существует" }, { status: 400 });
      }
      return NextResponse.json({ error: "Ошибка создания" }, { status: 500 });
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof Error && err.message === "Forbidden")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
