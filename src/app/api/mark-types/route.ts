import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const markTypes = await prisma.markType.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, defaultHours: true, color: true },
  });

  return NextResponse.json(markTypes);
}
