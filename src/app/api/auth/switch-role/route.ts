import { NextResponse } from "next/server";

// Endpoint удалён — переключение ролей выполняется через signIn() напрямую на клиенте
export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
