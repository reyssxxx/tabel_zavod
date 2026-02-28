import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";

export async function POST(request: Request) {
  const { userId } = await request.json();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Возвращаем данные пользователя — клиент сделает signIn
  return NextResponse.json({
    email: user.email,
    role: user.role,
    name: user.name,
  });
}
