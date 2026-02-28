import { NextResponse } from "next/server";
import { getCurrentUser, requireRole } from "@/lib/auth-utils";
import { getWorkHoursPerDay, setWorkHoursPerDay } from "@/lib/work-hours";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ hoursPerDay: getWorkHoursPerDay() });
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

  setWorkHoursPerDay(hoursPerDay);
  return NextResponse.json({ hoursPerDay: getWorkHoursPerDay() });
}
