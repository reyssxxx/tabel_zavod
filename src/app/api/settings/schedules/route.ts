import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const schedules = await prisma.workSchedule.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const name = body.name?.trim();
  const hoursPerDay = Number(body.hoursPerDay);

  if (!name) return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  if (!hoursPerDay || hoursPerDay < 1 || hoursPerDay > 24) {
    return NextResponse.json({ error: "Часов в день: от 1 до 24" }, { status: 400 });
  }

  try {
    const schedule = await prisma.workSchedule.create({ data: { name, hoursPerDay } });
    return NextResponse.json(schedule, { status: 201 });
  } catch {
    return NextResponse.json({ error: "График с таким названием уже существует" }, { status: 400 });
  }
}
