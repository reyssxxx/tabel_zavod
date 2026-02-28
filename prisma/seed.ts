import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Очистка
  await prisma.timeRecord.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.markType.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.workSchedule.deleteMany();

  // === Графики работы ===
  const schedules = await Promise.all([
    prisma.workSchedule.create({ data: { name: "8-часовой", hoursPerDay: 8 } }),
    prisma.workSchedule.create({ data: { name: "Ночная смена (12ч)", hoursPerDay: 12 } }),
    prisma.workSchedule.create({ data: { name: "2/2 (12ч)", hoursPerDay: 12 } }),
    prisma.workSchedule.create({ data: { name: "Сутки/трое (24ч)", hoursPerDay: 24 } }),
  ]);

  const [sched8, schedNight, sched2x2, schedSutki] = schedules;

  // === Подразделения ===
  const departments = await Promise.all([
    prisma.department.create({ data: { name: "Цех №1" } }),
    prisma.department.create({ data: { name: "Цех №2" } }),
    prisma.department.create({ data: { name: "Цех №3" } }),
    prisma.department.create({ data: { name: "Отдел закупок" } }),
    prisma.department.create({ data: { name: "Бухгалтерия" } }),
    prisma.department.create({ data: { name: "ОТК" } }),
  ]);

  const [ceh1, ceh2, ceh3, zakupki, buh, otk] = departments;

  // === Типы отметок ===
  const markTypes = await Promise.all([
    prisma.markType.create({
      data: { code: "Я", name: "Явка", defaultHours: 8, color: "#22c55e" },
    }),
    prisma.markType.create({
      data: { code: "ОТ", name: "Отпуск", defaultHours: 0, color: "#3b82f6" },
    }),
    prisma.markType.create({
      data: { code: "Б", name: "Больничный", defaultHours: 0, color: "#ef4444" },
    }),
    prisma.markType.create({
      data: { code: "К", name: "Командировка", defaultHours: 8, color: "#f59e0b" },
    }),
    prisma.markType.create({
      data: { code: "П", name: "Прогул", defaultHours: 0, color: "#dc2626" },
    }),
    prisma.markType.create({
      data: { code: "С", name: "Сокращённый день", defaultHours: 4, color: "#a855f7" },
    }),
  ]);

  const [yavka, otpusk, bolnichniy, komandirovka, progul, sokr] = markTypes;

  // === Пользователи системы ===
  const passwordHash = await bcrypt.hash("admin123", 10);
  const masterHash = await bcrypt.hash("master123", 10);
  const buhHash = await bcrypt.hash("buh123", 10);

  await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@tabel.ru",
        passwordHash,
        name: "Администратор",
        role: "ADMIN",
        departmentId: null,
      },
    }),
    prisma.user.create({
      data: {
        email: "master@tabel.ru",
        passwordHash: masterHash,
        name: "Мастер Цеха №1",
        role: "MANAGER",
        departmentId: ceh1.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "buh@tabel.ru",
        passwordHash: buhHash,
        name: "Бухгалтер Петрова",
        role: "ACCOUNTANT",
        departmentId: null,
      },
    }),
  ]);

  // === Сотрудники ===
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        fullName: "Иванов Иван Иванович",
        position: "Сборщик-клепальщик",
        departmentId: ceh1.id,
        personnelNumber: "101",
        scheduleId: sched8.id,
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Петров Пётр Петрович",
        position: "Оператор ЧПУ",
        departmentId: ceh1.id,
        personnelNumber: "102",
        scheduleId: sched2x2.id, // работает по графику 2/2
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Сидорова Анна Михайловна",
        position: "Инженер-технолог",
        departmentId: ceh2.id,
        personnelNumber: "201",
        scheduleId: sched8.id,
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Козлов Дмитрий Сергеевич",
        position: "Слесарь-сборщик",
        departmentId: ceh2.id,
        personnelNumber: "202",
        scheduleId: sched8.id,
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Новикова Елена Александровна",
        position: "Контролёр ОТК",
        departmentId: otk.id,
        personnelNumber: "301",
        scheduleId: sched8.id,
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Морозов Алексей Владимирович",
        position: "Токарь",
        departmentId: ceh3.id,
        personnelNumber: "401",
        scheduleId: schedNight.id, // ночная смена
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Волкова Мария Дмитриевна",
        position: "Специалист по закупкам",
        departmentId: zakupki.id,
        personnelNumber: "501",
        scheduleId: sched8.id,
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Соколов Андрей Николаевич",
        position: "Фрезеровщик",
        departmentId: ceh3.id,
        personnelNumber: "402",
        scheduleId: sched8.id,
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Лебедева Ольга Игоревна",
        position: "Бухгалтер",
        departmentId: buh.id,
        personnelNumber: "601",
        scheduleId: sched8.id,
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Кузнецов Сергей Павлович",
        position: "Электромонтажник",
        departmentId: ceh1.id,
        personnelNumber: "103",
        isActive: false, // уволен — для демонстрации
        scheduleId: sched8.id,
      },
    }),
  ]);

  // === Демо: совместитель — Иванов числится и в Цех №1 (осн.) и в ОТК (совм.) ===
  const ivanov = employees[0]; // Иванов, Цех №1
  const novikovaOtk = employees[4]; // Новикова, ОТК — сделаем её совместителем Иванова для демо

  // Иванов также числится в ОТК как совместитель (второй табельный номер)
  const ivanovOtk = await prisma.employee.create({
    data: {
      fullName: "Иванов Иван Иванович",
      position: "Контролёр (совместитель)",
      departmentId: otk.id,
      personnelNumber: "101-С", // суффикс -С = совместитель
      scheduleId: sched8.id,
      linkedEmployeeId: ivanov.id,
    },
  });
  // Обратная ссылка
  await prisma.employee.update({
    where: { id: ivanov.id },
    data: { linkedEmployeeId: ivanovOtk.id },
  });

  // === Праздничные дни РФ 2026 ===
  const holidays2026 = [
    { date: new Date("2026-01-01"), name: "Новогодние каникулы" },
    { date: new Date("2026-01-02"), name: "Новогодние каникулы" },
    { date: new Date("2026-01-03"), name: "Новогодние каникулы" },
    { date: new Date("2026-01-04"), name: "Новогодние каникулы" },
    { date: new Date("2026-01-05"), name: "Новогодние каникулы" },
    { date: new Date("2026-01-06"), name: "Новогодние каникулы" },
    { date: new Date("2026-01-07"), name: "Рождество Христово" },
    { date: new Date("2026-01-08"), name: "Новогодние каникулы" },
    { date: new Date("2026-02-23"), name: "День защитника Отечества" },
    { date: new Date("2026-03-08"), name: "Международный женский день" },
    { date: new Date("2026-05-01"), name: "Праздник Весны и Труда" },
    { date: new Date("2026-05-09"), name: "День Победы" },
    { date: new Date("2026-06-12"), name: "День России" },
    { date: new Date("2026-11-04"), name: "День народного единства" },
    { date: new Date("2026-02-22"), name: "Предпраздничный день", isShortened: true },
    { date: new Date("2026-03-07"), name: "Предпраздничный день", isShortened: true },
    { date: new Date("2026-04-30"), name: "Предпраздничный день", isShortened: true },
    { date: new Date("2026-05-08"), name: "Предпраздничный день", isShortened: true },
    { date: new Date("2026-06-11"), name: "Предпраздничный день", isShortened: true },
    { date: new Date("2026-11-03"), name: "Предпраздничный день", isShortened: true },
  ];

  for (const h of holidays2026) {
    await prisma.holiday.create({
      data: { date: h.date, name: h.name, isShortened: h.isShortened ?? false },
    });
  }

  // === Заполнение табеля за текущий месяц ===
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const allEmployees = [...employees, ivanovOtk];
  const activeEmployees = allEmployees.filter((e) => e.isActive);
  const workMarkTypes = [yavka, yavka, yavka, yavka, yavka, otpusk, bolnichniy, komandirovka, sokr];

  for (const emp of activeEmployees) {
    for (let day = 1; day <= Math.min(daysInMonth, now.getDate()); day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      if (Math.random() > 0.8) continue;

      const mark = workMarkTypes[Math.floor(Math.random() * workMarkTypes.length)];
      await prisma.timeRecord.create({
        data: { employeeId: emp.id, date, markTypeId: mark.id, slot: 0, overtimeHours: 0 },
      });
    }
  }

  console.log("Seed completed successfully!");
  console.log(`- ${departments.length} departments`);
  console.log(`- ${schedules.length} work schedules`);
  console.log(`- ${allEmployees.length} employees (incl. 1 part-timer)`);
  console.log(`- ${markTypes.length} mark types`);
  console.log(`- ${holidays2026.length} holidays`);
  console.log(`- 3 users (admin@tabel.ru, master@tabel.ru, buh@tabel.ru)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
