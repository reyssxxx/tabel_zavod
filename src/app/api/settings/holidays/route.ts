import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireRole } from "@/lib/auth-utils";
import { invalidateHolidayCache } from "@/lib/holidays";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } });

  return NextResponse.json(
    holidays.map((h) => ({
      id: h.id,
      date: h.date.toISOString().split("T")[0],
      name: h.name,
      isShortened: h.isShortened,
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
  const { date, name, isShortened = false } = body;

  if (!date || !name) {
    return NextResponse.json({ error: "Дата и название обязательны" }, { status: 400 });
  }

  try {
    const holiday = await prisma.holiday.create({
      data: { date: new Date(date), name, isShortened },
    });
    invalidateHolidayCache();
    return NextResponse.json(
      {
        id: holiday.id,
        date: holiday.date.toISOString().split("T")[0],
        name: holiday.name,
        isShortened: holiday.isShortened,
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Праздник на эту дату уже существует" },
        { status: 400 }
      );
    }
    throw e;
  }
}
