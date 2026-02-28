import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";
import { invalidateHolidayCache } from "@/lib/holidays";

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

  const data: { date?: Date; name?: string; isShortened?: boolean } = {};
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.name !== undefined) data.name = body.name;
  if (body.isShortened !== undefined) data.isShortened = body.isShortened;

  try {
    const holiday = await prisma.holiday.update({ where: { id }, data });
    invalidateHolidayCache();
    return NextResponse.json({
      id: holiday.id,
      date: holiday.date.toISOString().split("T")[0],
      name: holiday.name,
      isShortened: holiday.isShortened,
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e) {
      const code = (e as { code: string }).code;
      if (code === "P2002") {
        return NextResponse.json(
          { error: "Праздник на эту дату уже существует" },
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

  try {
    await prisma.holiday.delete({ where: { id } });
    invalidateHolidayCache();
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
