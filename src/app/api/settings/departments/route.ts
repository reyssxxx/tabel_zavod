import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireRole } from "@/lib/auth-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const departments = await prisma.department.findMany({
    include: {
      _count: {
        select: { employees: { where: { isActive: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    departments.map((d) => ({
      id: d.id,
      name: d.name,
      employeeCount: d._count.employees,
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
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  }

  try {
    const department = await prisma.department.create({ data: { name } });
    return NextResponse.json(department, { status: 201 });
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Подразделение с таким названием уже существует" },
        { status: 400 }
      );
    }
    throw e;
  }
}
