import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireRole } from "@/lib/auth-utils"; // getCurrentUser used in GET
import { DEFAULT_OT_COEF_1, DEFAULT_OT_COEF_2, DEFAULT_OT_THRESHOLD, DEFAULT_WEEKEND_COEF, DEFAULT_HOLIDAY_COEF } from "@/lib/salary";

async function getSetting(key: string, defaultVal: number): Promise<number> {
  const row = await prisma.appSettings.findUnique({ where: { key } });
  if (!row) return defaultVal;
  const v = parseFloat(row.value);
  return isFinite(v) ? v : defaultVal;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [otCoef1, otCoef2, otThreshold, weekendCoef, holidayCoef] = await Promise.all([
    getSetting("ot_coef_1", DEFAULT_OT_COEF_1),
    getSetting("ot_coef_2", DEFAULT_OT_COEF_2),
    getSetting("ot_threshold", DEFAULT_OT_THRESHOLD),
    getSetting("weekend_coef", DEFAULT_WEEKEND_COEF),
    getSetting("holiday_coef", DEFAULT_HOLIDAY_COEF),
  ]);

  return NextResponse.json({ otCoef1, otCoef2, otThreshold, weekendCoef, holidayCoef });
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole("ADMIN");

    const body = await request.json();
    const otCoef1 = Number(body.otCoef1);
    const otCoef2 = Number(body.otCoef2);
    const otThreshold = Number(body.otThreshold);
    const weekendCoef = Number(body.weekendCoef);
    const holidayCoef = Number(body.holidayCoef);

    if (!isFinite(otCoef1) || otCoef1 <= 0) return NextResponse.json({ error: "Некорректный коэффициент СВ 1" }, { status: 400 });
    if (!isFinite(otCoef2) || otCoef2 <= 0) return NextResponse.json({ error: "Некорректный коэффициент СВ 2" }, { status: 400 });
    if (!isFinite(otThreshold) || otThreshold < 0) return NextResponse.json({ error: "Некорректный порог" }, { status: 400 });
    if (!isFinite(weekendCoef) || weekendCoef <= 0) return NextResponse.json({ error: "Некорректный коэффициент выходных" }, { status: 400 });
    if (!isFinite(holidayCoef) || holidayCoef <= 0) return NextResponse.json({ error: "Некорректный коэффициент праздников" }, { status: 400 });

    await Promise.all([
      prisma.appSettings.upsert({ where: { key: "ot_coef_1" }, update: { value: String(otCoef1) }, create: { key: "ot_coef_1", value: String(otCoef1) } }),
      prisma.appSettings.upsert({ where: { key: "ot_coef_2" }, update: { value: String(otCoef2) }, create: { key: "ot_coef_2", value: String(otCoef2) } }),
      prisma.appSettings.upsert({ where: { key: "ot_threshold" }, update: { value: String(otThreshold) }, create: { key: "ot_threshold", value: String(otThreshold) } }),
      prisma.appSettings.upsert({ where: { key: "weekend_coef" }, update: { value: String(weekendCoef) }, create: { key: "weekend_coef", value: String(weekendCoef) } }),
      prisma.appSettings.upsert({ where: { key: "holiday_coef" }, update: { value: String(holidayCoef) }, create: { key: "holiday_coef", value: String(holidayCoef) } }),
    ]);

    return NextResponse.json({ otCoef1, otCoef2, otThreshold, weekendCoef, holidayCoef });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof Error && err.message === "Forbidden")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
