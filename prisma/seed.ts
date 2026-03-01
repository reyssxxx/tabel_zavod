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
  await prisma.position.deleteMany();
  await prisma.appSettings.deleteMany();

  // === Графики работы ===
  const schedules = await Promise.all([
    prisma.workSchedule.create({ data: { name: "8-часовой", hoursPerDay: 8 } }),
    prisma.workSchedule.create({ data: { name: "Ночная смена (12ч)", hoursPerDay: 12 } }),
    prisma.workSchedule.create({ data: { name: "2/2 (12ч)", hoursPerDay: 12 } }),
    prisma.workSchedule.create({ data: { name: "Сутки/трое (24ч)", hoursPerDay: 24 } }),
  ]);

  const [sched8, schedNight, sched2x2, schedSutki] = schedules;

  // === Должности ===
  const positionData = [
    { name: "Сборщик-клепальщик", baseSalary: 72000 },
    { name: "Оператор ЧПУ", baseSalary: 85000 },
    { name: "Инженер-технолог", baseSalary: 95000 },
    { name: "Слесарь-сборщик", baseSalary: 68000 },
    { name: "Контролёр ОТК", baseSalary: 74000 },
    { name: "Токарь", baseSalary: 76000 },
    { name: "Специалист по закупкам", baseSalary: 82000 },
    { name: "Фрезеровщик", baseSalary: 78000 },
    { name: "Бухгалтер", baseSalary: 88000 },
    { name: "Электромонтажник", baseSalary: 80000 },
    { name: "Контролёр (совместитель)", baseSalary: 37000 },
  ];
  const createdPositions = await Promise.all(
    positionData.map((p) => prisma.position.create({ data: p }))
  );
  const posMap = new Map(createdPositions.map((p) => [p.name, p.id]));

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
  const hashes = await Promise.all([
    bcrypt.hash("Zvezda@2026",  10), // admin
    bcrypt.hash("Beriev@2026",  10), // admin2
    bcrypt.hash("Ceh1Master!",  10), // manager ceh1
    bcrypt.hash("Ceh2Master!",  10), // manager ceh2
    bcrypt.hash("Ceh3Master!",  10), // manager ceh3
    bcrypt.hash("Buhgalter1!",  10), // accountant
    bcrypt.hash("Buhgalter2!",  10), // accountant2
    bcrypt.hash("HrOtdel2026!", 10), // hr
    bcrypt.hash("HrSpec2026!",  10), // hr2
  ]);
  const [
    hashAdmin1, hashAdmin2,
    hashMgr1, hashMgr2, hashMgr3,
    hashBuh1, hashBuh2,
    hashHr1, hashHr2,
  ] = hashes;

  await Promise.all([
    // ADMIN
    prisma.user.create({
      data: {
        email: "admin@tabel.ru",
        passwordHash: hashAdmin1,
        name: "Администратор",
        role: "ADMIN",
        departmentId: null,
      },
    }),
    prisma.user.create({
      data: {
        email: "sokolov.dmitry@tantk.ru",
        passwordHash: hashAdmin2,
        name: "Соколов Дмитрий Игоревич",
        role: "ADMIN",
        departmentId: null,
      },
    }),

    // MANAGER
    prisma.user.create({
      data: {
        email: "master@tabel.ru",
        passwordHash: hashMgr1,
        name: "Мастер Цеха №1",
        role: "MANAGER",
        departmentId: ceh1.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "vasiliev.oleg@tantk.ru",
        passwordHash: hashMgr1,
        name: "Васильев Олег Николаевич",
        role: "MANAGER",
        departmentId: ceh1.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "zaharov.roman@tantk.ru",
        passwordHash: hashMgr2,
        name: "Захаров Роман Викторович",
        role: "MANAGER",
        departmentId: ceh2.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "fedorov.mikhail@tantk.ru",
        passwordHash: hashMgr3,
        name: "Фёдоров Михаил Андреевич",
        role: "MANAGER",
        departmentId: ceh3.id,
      },
    }),

    // ACCOUNTANT
    prisma.user.create({
      data: {
        email: "buh@tabel.ru",
        passwordHash: hashBuh1,
        name: "Бухгалтер Петрова",
        role: "ACCOUNTANT",
        departmentId: null,
      },
    }),
    prisma.user.create({
      data: {
        email: "petrova.marina@tantk.ru",
        passwordHash: hashBuh1,
        name: "Петрова Марина Сергеевна",
        role: "ACCOUNTANT",
        departmentId: null,
      },
    }),
    prisma.user.create({
      data: {
        email: "orlova.natalia@tantk.ru",
        passwordHash: hashBuh2,
        name: "Орлова Наталья Юрьевна",
        role: "ACCOUNTANT",
        departmentId: null,
      },
    }),

    // HR
    prisma.user.create({
      data: {
        email: "hr@tabel.ru",
        passwordHash: hashHr1,
        name: "Специалист ОК",
        role: "HR",
        departmentId: null,
      },
    }),
    prisma.user.create({
      data: {
        email: "smirnova.elena@tantk.ru",
        passwordHash: hashHr1,
        name: "Смирнова Елена Павловна",
        role: "HR",
        departmentId: null,
      },
    }),
    prisma.user.create({
      data: {
        email: "kuznetsova.irina@tantk.ru",
        passwordHash: hashHr2,
        name: "Кузнецова Ирина Владимировна",
        role: "HR",
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
        positionId: posMap.get("Сборщик-клепальщик"),
        hireDate: new Date("2015-03-15"), // стаж ~11 лет → 100%
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Петров Пётр Петрович",
        position: "Оператор ЧПУ",
        departmentId: ceh1.id,
        personnelNumber: "102",
        scheduleId: sched2x2.id,
        positionId: posMap.get("Оператор ЧПУ"),
        hireDate: new Date("2020-07-01"), // стаж ~5 лет → 80%
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Сидорова Анна Михайловна",
        position: "Инженер-технолог",
        departmentId: ceh2.id,
        personnelNumber: "201",
        scheduleId: sched8.id,
        positionId: posMap.get("Инженер-технолог"),
        hireDate: new Date("2010-01-20"), // стаж ~16 лет → 100%
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Козлов Дмитрий Сергеевич",
        position: "Слесарь-сборщик",
        departmentId: ceh2.id,
        personnelNumber: "202",
        scheduleId: sched8.id,
        positionId: posMap.get("Слесарь-сборщик"),
        hireDate: new Date("2023-09-10"), // стаж ~2 года → 60%
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Новикова Елена Александровна",
        position: "Контролёр ОТК",
        departmentId: otk.id,
        personnelNumber: "301",
        scheduleId: sched8.id,
        positionId: posMap.get("Контролёр ОТК"),
        hireDate: new Date("2018-04-05"), // стаж ~8 лет → 100%
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Морозов Алексей Владимирович",
        position: "Токарь",
        departmentId: ceh3.id,
        personnelNumber: "401",
        scheduleId: schedNight.id,
        positionId: posMap.get("Токарь"),
        hireDate: new Date("2019-11-01"), // стаж ~6 лет → 80%
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Волкова Мария Дмитриевна",
        position: "Специалист по закупкам",
        departmentId: zakupki.id,
        personnelNumber: "501",
        scheduleId: sched8.id,
        positionId: posMap.get("Специалист по закупкам"),
        hireDate: new Date("2016-06-12"), // стаж ~9 лет → 100%
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Соколов Андрей Николаевич",
        position: "Фрезеровщик",
        departmentId: ceh3.id,
        personnelNumber: "402",
        scheduleId: sched8.id,
        positionId: posMap.get("Фрезеровщик"),
        hireDate: new Date("2022-02-28"), // стаж ~4 года → 60%
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Лебедева Ольга Игоревна",
        position: "Бухгалтер",
        departmentId: buh.id,
        personnelNumber: "601",
        scheduleId: sched8.id,
        positionId: posMap.get("Бухгалтер"),
        hireDate: new Date("2013-08-19"), // стаж ~12 лет → 100%
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Кузнецов Сергей Павлович",
        position: "Электромонтажник",
        departmentId: ceh1.id,
        personnelNumber: "103",
        isActive: false,
        scheduleId: sched8.id,
        positionId: posMap.get("Электромонтажник"),
        hireDate: new Date("2017-03-01"),
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
      positionId: posMap.get("Контролёр (совместитель)"),
      hireDate: new Date("2015-03-15"), // тот же Иванов
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

  // === Заполнение табеля: февраль полностью + март до сегодня ===
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();

  const allEmployees = [...employees, ivanovOtk];
  const activeEmployees = allEmployees.filter((e) => e.isActive);

  // Месяцы для заполнения: январь, февраль, март (текущий)
  const monthsToFill = [
    { year: 2026, month: 0, lastDay: 31 },  // январь — полный
    { year: 2026, month: 1, lastDay: 28 },  // февраль — полный
    { year: todayYear, month: todayMonth, lastDay: todayDay }, // текущий — до сегодня
  ].filter(
    // дедупликация: не добавлять текущий если уже есть в списке
    (m, i, arr) => arr.findIndex((x) => x.year === m.year && x.month === m.month) === i
  );

  for (const { year, month, lastDay } of monthsToFill) {
    for (const emp of activeEmployees) {
      // У каждого сотрудника свой паттерн: один человек может быть в отпуске неделю
      const vacationStart = Math.floor(Math.random() * 20) + 1;
      const onVacation = Math.random() < 0.15; // 15% шанс что в этом месяце отпуск

      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue; // пропускаем вых.

        let mark: typeof yavka;
        if (onVacation && day >= vacationStart && day < vacationStart + 7) {
          mark = otpusk;
        } else if (Math.random() < 0.05) {
          // 5% — пропустит день (больничный или прогул)
          mark = Math.random() < 0.7 ? bolnichniy : progul;
        } else if (Math.random() < 0.03) {
          mark = komandirovka;
        } else {
          mark = yavka;
        }

        await prisma.timeRecord.create({
          data: { employeeId: emp.id, date, markTypeId: mark.id, slot: 0, overtimeHours: 0 },
        });
      }
    }
  }


  console.log("Seed completed successfully!");
  console.log(`- ${departments.length} departments`);
  console.log(`- ${schedules.length} work schedules`);
  console.log(`- ${createdPositions.length} positions with salaries`);
  console.log(`- ${allEmployees.length} employees (incl. 1 part-timer)`);
  console.log(`- ${markTypes.length} mark types`);
  console.log(`- ${holidays2026.length} holidays`);
  console.log(`- 12 users (admin, managers, accountants, HR — see table below)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
