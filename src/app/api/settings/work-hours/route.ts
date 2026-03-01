import { NextResponse } from "next/server";
import { getCurrentUser, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

const WORK_HOURS_KEY = "work_hours_per_day";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const setting = await prisma.appSettings.findUnique({ where: { key: WORK_HOURS_KEY } });
  const hoursPerDay = setting ? parseFloat(setting.value) : 8;
  return NextResponse.json({ hoursPerDay });
}

export async function PUT(request: Request) {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { hoursPerDay } = body;

  if (typeof hoursPerDay !== "number" || hoursPerDay < 1 || hoursPerDay > 24) {
    return NextResponse.json(
      { error: "Часов должно быть от 1 до 24" },
      { status: 400 }
    );
  }

  await prisma.appSettings.upsert({
    where: { key: WORK_HOURS_KEY },
    update: { value: String(hoursPerDay) },
    create: { key: WORK_HOURS_KEY, value: String(hoursPerDay) },
  });

  return NextResponse.json({ hoursPerDay });
}
