import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV файл пуст или не содержит данных" },
        { status: 400 }
      );
    }

    // Определяем разделитель по заголовку
    const headerLine = lines[0];
    const delimiter = headerLine.split(";").length >= headerLine.split(",").length ? ";" : ",";

    const headers = headerLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ""));

    // Ожидаемые колонки
    const colFio = headers.findIndex((h) =>
      h.toLowerCase().includes("фио") || h.toLowerCase().includes("ф.и.о")
    );
    const colPosition = headers.findIndex((h) =>
      h.toLowerCase().includes("должност")
    );
    const colDept = headers.findIndex((h) =>
      h.toLowerCase().includes("подразделен") || h.toLowerCase().includes("цех") || h.toLowerCase().includes("отдел")
    );
    const colPersonnel = headers.findIndex((h) =>
      h.toLowerCase().includes("табельн")
    );

    if (colFio === -1 || colPosition === -1 || colDept === -1 || colPersonnel === -1) {
      return NextResponse.json(
        {
          error:
            "Неверный формат CSV. Ожидаемые колонки: ФИО, Должность, Подразделение, Табельный номер",
        },
        { status: 400 }
      );
    }

    // Загружаем все подразделения для матчинга по имени
    const departments = await prisma.department.findMany({
      select: { id: true, name: true },
    });
    const deptMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));

    const errors: string[] = [];
    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""));
      const rowNum = i + 1;

      const fio = cols[colFio] ?? "";
      const position = cols[colPosition] ?? "";
      const deptName = cols[colDept] ?? "";
      const personnelNumber = cols[colPersonnel] ?? "";

      if (!fio || !position || !deptName || !personnelNumber) {
        errors.push(`Строка ${rowNum}: пустые обязательные поля`);
        continue;
      }

      const departmentId = deptMap.get(deptName.toLowerCase());
      if (!departmentId) {
        errors.push(`Строка ${rowNum}: подразделение "${deptName}" не найдено`);
        continue;
      }

      // Проверка уникальности
      const existing = await prisma.employee.findUnique({
        where: { personnelNumber },
        select: { id: true },
      });
      if (existing) {
        errors.push(`Строка ${rowNum}: табельный номер "${personnelNumber}" уже занят`);
        continue;
      }

      try {
        await prisma.employee.create({
          data: {
            fullName: fio,
            position,
            departmentId,
            personnelNumber,
          },
        });
        imported++;
      } catch {
        errors.push(`Строка ${rowNum}: ошибка при создании сотрудника "${fio}"`);
      }
    }

    return NextResponse.json({ imported, errors });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
