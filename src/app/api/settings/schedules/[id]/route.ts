import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const name = body.name?.trim();
  const hoursPerDay = Number(body.hoursPerDay);

  if (!name) return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  if (!hoursPerDay || hoursPerDay < 1 || hoursPerDay > 24) {
    return NextResponse.json({ error: "Часов в день: от 1 до 24" }, { status: 400 });
  }

  try {
    const schedule = await prisma.workSchedule.update({
      where: { id },
      data: { name, hoursPerDay },
    });
    return NextResponse.json(schedule);
  } catch {
    return NextResponse.json({ error: "Ошибка обновления" }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const empCount = await prisma.employee.count({ where: { scheduleId: id } });
  if (empCount > 0) {
    return NextResponse.json(
      { error: "Нельзя удалить график, назначенный сотрудникам" },
      { status: 400 }
    );
  }

  try {
    await prisma.workSchedule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
