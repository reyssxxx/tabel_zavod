import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Февраль 2026: 28 дней, пн=2, вт=3, ср=4, чт=5, пт=6
// Рабочие дни февраля 2026 (кроме вых. и 23-го):
// 2,3,4,5,6, 9,10,11,12,13, 16,17,18,19,20, 24,25,26,27,28
// Выходные: 1(вс),7(сб),8(вс),14(сб),15(вс),21(сб),22(вс — предпраздничный рабочий сокращённый),23(пн — праздник),28(сб)
// Итого рабочих дней: 19 (22-е сокращённый, 23-е праздник → выходной)

function isWeekend(year: number, month: number, day: number) {
  const d = new Date(year, month, day).getDay();
  return d === 0 || d === 6;
}

function isHoliday(day: number) {
  return day === 23; // 23 февраля — праздник
}

function isShortened(day: number) {
  return day === 22; // 22 февраля — предпраздничный
}

// Все рабочие дни февраля 2026
const FEB_WORK_DAYS = Array.from({ length: 28 }, (_, i) => i + 1).filter(
  (d) => !isWeekend(2026, 1, d) && !isHoliday(d)
);

// Выходные дни февраля (для редких выходов на работу)
const FEB_WEEKEND_DAYS = Array.from({ length: 28 }, (_, i) => i + 1).filter(
  (d) => isWeekend(2026, 1, d) && !isHoliday(d)
);

type MarkType = { id: string; code: string };

function buildFebruaryMarks(
  empId: string,
  pattern: "normal" | "many_sick" | "many_absent" | "on_vacation" | "business_trips",
  markMap: Record<string, MarkType>,
  weekendWorker = false
): Array<{ employeeId: string; date: Date; markTypeId: string; slot: number; overtimeHours: number }> {
  const records = [];
  const { ya, ot, b, k, p, s } = markMap;

  for (const day of FEB_WORK_DAYS) {
    const date = new Date(2026, 1, day);
    let mark: MarkType;

    if (isShortened(day)) {
      mark = s; // 22-е всегда сокращённый
    } else if (pattern === "normal") {
      const r = Math.random();
      if (r < 0.02) mark = b;
      else if (r < 0.03) mark = p;
      else if (r < 0.05) mark = k;
      else mark = ya;
    } else if (pattern === "many_sick") {
      // Аномалия: заболел примерно с 10-го по 21-е
      if (day >= 10 && day <= 21) mark = b;
      else if (Math.random() < 0.04) mark = p;
      else mark = ya;
    } else if (pattern === "many_absent") {
      // Аномалия: много прогулов — 30% дней прогул
      const r = Math.random();
      if (r < 0.30) mark = p;
      else if (r < 0.35) mark = b;
      else mark = ya;
    } else if (pattern === "on_vacation") {
      // Весь февраль в отпуске
      mark = ot;
    } else if (pattern === "business_trips") {
      // Большую часть в командировках
      const r = Math.random();
      if (r < 0.60) mark = k;
      else mark = ya;
    } else {
      mark = ya;
    }

    records.push({
      employeeId: empId,
      date,
      markTypeId: mark.id,
      slot: 0,
      overtimeHours: 0,
    });
  }

  // Редкие выходы на работу в выходные (только normal + weekendWorker)
  if (weekendWorker) {
    const shuffled = [...FEB_WEEKEND_DAYS].sort(() => Math.random() - 0.5);
    const count = Math.floor(Math.random() * 2) + 1; // 1-2 выходных
    for (const day of shuffled.slice(0, count)) {
      records.push({
        employeeId: empId,
        date: new Date(2026, 1, day),
        markTypeId: ya.id,
        slot: 0,
        overtimeHours: 8,
      });
    }
  }

  return records;
}

async function main() {
  // === Очистка ===
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
  const [sched8, schedNight, sched2x2, schedSutki] = await Promise.all([
    prisma.workSchedule.create({ data: { name: "8-часовой", hoursPerDay: 8 } }),
    prisma.workSchedule.create({ data: { name: "Ночная смена (12ч)", hoursPerDay: 12 } }),
    prisma.workSchedule.create({ data: { name: "2/2 (12ч)", hoursPerDay: 12 } }),
    prisma.workSchedule.create({ data: { name: "Сутки/трое (24ч)", hoursPerDay: 24 } }),
  ]);

  // === Должности (IT-завод) ===
  const positionData = [
    // Производство / цеха
    { name: "Оператор ЧПУ (PCB)", baseSalary: 92000 },
    { name: "Монтажник РЭА", baseSalary: 78000 },
    { name: "Инженер-электронщик", baseSalary: 115000 },
    { name: "Инженер-программист встраиваемых систем", baseSalary: 130000 },
    { name: "Техник по калибровке", baseSalary: 84000 },
    { name: "Слесарь-сборщик приборов", baseSalary: 72000 },
    { name: "Пайщик SMD", baseSalary: 76000 },
    // ОТК
    { name: "Контролёр ОТК (электроника)", baseSalary: 88000 },
    { name: "Инженер по качеству", baseSalary: 110000 },
    // IT-отдел
    { name: "Инженер САПР", baseSalary: 140000 },
    { name: "Системный администратор", baseSalary: 105000 },
    { name: "Программист АСУ ТП", baseSalary: 135000 },
    { name: "Специалист по кибербезопасности", baseSalary: 145000 },
    // Логистика / снабжение
    { name: "Специалист по закупкам (компоненты)", baseSalary: 95000 },
    { name: "Кладовщик склада комплектующих", baseSalary: 65000 },
    // Бухгалтерия
    { name: "Бухгалтер", baseSalary: 88000 },
    { name: "Контролёр (совместитель)", baseSalary: 37000 },
  ];
  const createdPositions = await Promise.all(
    positionData.map((p) => prisma.position.create({ data: p }))
  );
  const posMap = new Map(createdPositions.map((p) => [p.name, p.id]));

  // === Подразделения (IT-завод) ===
  const [ceh1, ceh2, ceh3, itDep, otk, zakupki, buh] = await Promise.all([
    prisma.department.create({ data: { name: "Цех сборки PCB" } }),
    prisma.department.create({ data: { name: "Цех монтажа и пайки" } }),
    prisma.department.create({ data: { name: "Цех финальной сборки" } }),
    prisma.department.create({ data: { name: "Отдел информационных технологий" } }),
    prisma.department.create({ data: { name: "ОТК" } }),
    prisma.department.create({ data: { name: "Отдел снабжения" } }),
    prisma.department.create({ data: { name: "Бухгалтерия" } }),
  ]);

  // === Типы отметок ===
  const [ya, ot, b, k, p, s] = await Promise.all([
    prisma.markType.create({ data: { code: "Я",  name: "Явка",             defaultHours: 8,  color: "#22c55e" } }),
    prisma.markType.create({ data: { code: "ОТ", name: "Отпуск",           defaultHours: 0,  color: "#3b82f6" } }),
    prisma.markType.create({ data: { code: "Б",  name: "Больничный",       defaultHours: 0,  color: "#ef4444" } }),
    prisma.markType.create({ data: { code: "К",  name: "Командировка",     defaultHours: 8,  color: "#f59e0b" } }),
    prisma.markType.create({ data: { code: "П",  name: "Прогул",           defaultHours: 0,  color: "#dc2626" } }),
    prisma.markType.create({ data: { code: "С",  name: "Сокращённый день", defaultHours: 4,  color: "#a855f7" } }),
  ]);
  const markMap = { ya, ot, b, k, p, s };

  // === Пользователи системы ===
  const hashes = await Promise.all([
    bcrypt.hash("Zvezda@2026",  10),
    bcrypt.hash("Beriev@2026",  10),
    bcrypt.hash("Ceh1Master!",  10),
    bcrypt.hash("Ceh2Master!",  10),
    bcrypt.hash("Ceh3Master!",  10),
    bcrypt.hash("ItMaster!",    10),
    bcrypt.hash("Buhgalter1!",  10),
    bcrypt.hash("Buhgalter2!",  10),
    bcrypt.hash("HrOtdel2026!", 10),
    bcrypt.hash("HrSpec2026!",  10),
  ]);
  const [hA1, hA2, hM1, hM2, hM3, hM4, hB1, hB2, hH1, hH2] = hashes;

  await Promise.all([
    prisma.user.create({ data: { email: "admin@tabel.ru",           passwordHash: hA1, name: "Администратор",                  role: "ADMIN",     departmentId: null } }),
    prisma.user.create({ data: { email: "sokolov.dmitry@zavod.ru",  passwordHash: hA2, name: "Соколов Дмитрий Игоревич",       role: "ADMIN",     departmentId: null } }),
    prisma.user.create({ data: { email: "master@tabel.ru",          passwordHash: hM1, name: "Мастер Цеха PCB",                role: "MANAGER",   departmentId: ceh1.id } }),
    prisma.user.create({ data: { email: "zaharov.roman@zavod.ru",   passwordHash: hM2, name: "Захаров Роман Викторович",       role: "MANAGER",   departmentId: ceh2.id } }),
    prisma.user.create({ data: { email: "fedorov.mikhail@zavod.ru", passwordHash: hM3, name: "Фёдоров Михаил Андреевич",      role: "MANAGER",   departmentId: ceh3.id } }),
    prisma.user.create({ data: { email: "it.head@zavod.ru",         passwordHash: hM4, name: "Орлов Кирилл Дмитриевич",       role: "MANAGER",   departmentId: itDep.id } }),
    prisma.user.create({ data: { email: "buh@tabel.ru",             passwordHash: hB1, name: "Петрова Марина Сергеевна",      role: "ACCOUNTANT",departmentId: null } }),
    prisma.user.create({ data: { email: "orlova@zavod.ru",          passwordHash: hB2, name: "Орлова Наталья Юрьевна",        role: "ACCOUNTANT",departmentId: null } }),
    prisma.user.create({ data: { email: "hr@tabel.ru",              passwordHash: hH1, name: "Смирнова Елена Павловна",       role: "HR",        departmentId: null } }),
    prisma.user.create({ data: { email: "kuznetsova@zavod.ru",      passwordHash: hH2, name: "Кузнецова Ирина Владимировна", role: "HR",        departmentId: null } }),
  ]);

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
    await prisma.holiday.create({ data: { date: h.date, name: h.name, isShortened: h.isShortened ?? false } });
  }

  // =========================================================
  // === Сотрудники ==========================================
  // =========================================================
  // Формат: [ФИО, табельный №, подразделение, должность, график, дата найма, паттерн февраля, weekendWorker]
  type EmpDef = {
    fullName: string;
    pn: string;
    dept: typeof ceh1;
    pos: string;
    sched: typeof sched8;
    hire: string;
    pattern: "normal" | "many_sick" | "many_absent" | "on_vacation" | "business_trips";
    weekendWorker?: boolean;
    isActive?: boolean;
  };

  const empDefs: EmpDef[] = [
    // === ЦЕХ СБОРКИ PCB (ceh1) ===
    { fullName: "Иванов Иван Иванович",           pn: "101", dept: ceh1,    pos: "Оператор ЧПУ (PCB)",                               sched: sched8,    hire: "2015-03-15", pattern: "normal" },
    { fullName: "Петров Пётр Петрович",            pn: "102", dept: ceh1,    pos: "Оператор ЧПУ (PCB)",                               sched: sched2x2,  hire: "2020-07-01", pattern: "normal", weekendWorker: true },
    { fullName: "Кириллов Станислав Юрьевич",     pn: "103", dept: ceh1,    pos: "Монтажник РЭА",                                    sched: sched8,    hire: "2018-11-10", pattern: "normal" },
    { fullName: "Громова Татьяна Олеговна",       pn: "104", dept: ceh1,    pos: "Монтажник РЭА",                                    sched: sched8,    hire: "2021-04-12", pattern: "many_sick" },    // АНОМАЛИЯ: много больничных
    { fullName: "Белов Артём Николаевич",          pn: "105", dept: ceh1,    pos: "Пайщик SMD",                                       sched: sched8,    hire: "2022-09-01", pattern: "normal" },
    { fullName: "Семёнова Виктория Дмитриевна",   pn: "106", dept: ceh1,    pos: "Пайщик SMD",                                       sched: sched8,    hire: "2023-02-14", pattern: "many_absent" },  // АНОМАЛИЯ: много прогулов
    { fullName: "Лукин Денис Александрович",      pn: "107", dept: ceh1,    pos: "Пайщик SMD",                                       sched: sched8,    hire: "2019-06-30", pattern: "normal" },
    { fullName: "Фомина Нина Васильевна",          pn: "108", dept: ceh1,    pos: "Слесарь-сборщик приборов",                         sched: sched8,    hire: "2016-08-20", pattern: "normal" },
    { fullName: "Рыбаков Геннадий Павлович",      pn: "109", dept: ceh1,    pos: "Слесарь-сборщик приборов",                         sched: sched8,    hire: "2014-01-15", pattern: "normal" },
    { fullName: "Зайцева Ксения Романовна",        pn: "110", dept: ceh1,    pos: "Техник по калибровке",                             sched: sched8,    hire: "2024-03-01", pattern: "many_absent" },  // АНОМАЛИЯ: молодой, много прогулов

    // === ЦЕХ МОНТАЖА И ПАЙКИ (ceh2) ===
    { fullName: "Сидорова Анна Михайловна",        pn: "201", dept: ceh2,    pos: "Инженер-электронщик",                              sched: sched8,    hire: "2010-01-20", pattern: "normal" },
    { fullName: "Козлов Дмитрий Сергеевич",       pn: "202", dept: ceh2,    pos: "Монтажник РЭА",                                    sched: sched8,    hire: "2023-09-10", pattern: "normal" },
    { fullName: "Тарасова Людмила Игоревна",      pn: "203", dept: ceh2,    pos: "Монтажник РЭА",                                    sched: sched8,    hire: "2017-05-03", pattern: "normal" },
    { fullName: "Воробьёв Михаил Евгеньевич",    pn: "204", dept: ceh2,    pos: "Пайщик SMD",                                       sched: sched8,    hire: "2021-11-15", pattern: "many_sick" },    // АНОМАЛИЯ
    { fullName: "Ковалёва Светлана Петровна",    pn: "205", dept: ceh2,    pos: "Пайщик SMD",                                       sched: sched8,    hire: "2020-03-22", pattern: "normal" },
    { fullName: "Макаров Владимир Иванович",       pn: "206", dept: ceh2,    pos: "Слесарь-сборщик приборов",                         sched: sched8,    hire: "2015-07-10", pattern: "normal", weekendWorker: true },
    { fullName: "Никитина Ольга Владимировна",    pn: "207", dept: ceh2,    pos: "Техник по калибровке",                             sched: sched8,    hire: "2019-12-01", pattern: "normal" },
    { fullName: "Попов Роман Сергеевич",           pn: "208", dept: ceh2,    pos: "Слесарь-сборщик приборов",                         sched: sched2x2,  hire: "2022-06-18", pattern: "many_absent" }, // АНОМАЛИЯ
    { fullName: "Щербакова Марина Юрьевна",       pn: "209", dept: ceh2,    pos: "Техник по калибровке",                             sched: sched8,    hire: "2018-09-05", pattern: "on_vacation" },  // АНОМАЛИЯ: весь февраль отпуск
    { fullName: "Горбунов Илья Константинович",   pn: "210", dept: ceh2,    pos: "Монтажник РЭА",                                    sched: sched8,    hire: "2025-01-15", pattern: "normal" },

    // === ЦЕХ ФИНАЛЬНОЙ СБОРКИ (ceh3) ===
    { fullName: "Морозов Алексей Владимирович",   pn: "301", dept: ceh3,    pos: "Инженер-электронщик",                              sched: schedNight,hire: "2019-11-01", pattern: "normal" },
    { fullName: "Соколов Андрей Николаевич",       pn: "302", dept: ceh3,    pos: "Слесарь-сборщик приборов",                         sched: sched8,    hire: "2022-02-28", pattern: "normal" },
    { fullName: "Волкова Мария Дмитриевна",        pn: "303", dept: ceh3,    pos: "Монтажник РЭА",                                    sched: sched8,    hire: "2016-06-12", pattern: "normal" },
    { fullName: "Панов Сергей Витальевич",         pn: "304", dept: ceh3,    pos: "Оператор ЧПУ (PCB)",                               sched: sched8,    hire: "2020-10-05", pattern: "many_sick" },   // АНОМАЛИЯ
    { fullName: "Якимова Дарья Андреевна",         pn: "305", dept: ceh3,    pos: "Пайщик SMD",                                       sched: sched8,    hire: "2023-04-17", pattern: "normal" },
    { fullName: "Агафонов Игорь Леонидович",       pn: "306", dept: ceh3,    pos: "Техник по калибровке",                             sched: sched8,    hire: "2017-08-22", pattern: "normal", weekendWorker: true },
    { fullName: "Крылова Наталья Борисовна",       pn: "307", dept: ceh3,    pos: "Слесарь-сборщик приборов",                         sched: sched8,    hire: "2021-01-11", pattern: "normal" },
    { fullName: "Гусев Артём Фёдорович",          pn: "308", dept: ceh3,    pos: "Монтажник РЭА",                                    sched: sched8,    hire: "2024-07-01", pattern: "many_absent" },  // АНОМАЛИЯ
    { fullName: "Лисицына Юлия Михайловна",        pn: "309", dept: ceh3,    pos: "Оператор ЧПУ (PCB)",                               sched: sched2x2,  hire: "2018-03-14", pattern: "normal" },
    { fullName: "Борисов Константин Иванович",     pn: "310", dept: ceh3,    pos: "Инженер-электронщик",                              sched: sched8,    hire: "2013-05-19", pattern: "normal" },

    // === ОТДЕЛ ИТ (itDep) ===
    { fullName: "Орлов Кирилл Дмитриевич",         pn: "401", dept: itDep,   pos: "Программист АСУ ТП",                               sched: sched8,    hire: "2016-09-01", pattern: "normal" },
    { fullName: "Дмитриева Анастасия Сергеевна",  pn: "402", dept: itDep,   pos: "Инженер САПР",                                     sched: sched8,    hire: "2018-02-12", pattern: "business_trips" }, // АНОМАЛИЯ: много командировок
    { fullName: "Захаров Роман Александрович",     pn: "403", dept: itDep,   pos: "Системный администратор",                          sched: sched8,    hire: "2020-11-30", pattern: "normal" },
    { fullName: "Смирнов Павел Олегович",          pn: "404", dept: itDep,   pos: "Специалист по кибербезопасности",                  sched: sched8,    hire: "2021-04-05", pattern: "business_trips" }, // АНОМАЛИЯ: командировки
    { fullName: "Фёдорова Ирина Александровна",   pn: "405", dept: itDep,   pos: "Инженер САПР",                                     sched: sched8,    hire: "2019-07-22", pattern: "normal" },
    { fullName: "Виноградов Никита Валерьевич",   pn: "406", dept: itDep,   pos: "Программист АСУ ТП",                               sched: sched8,    hire: "2022-08-15", pattern: "normal" },
    { fullName: "Степанова Валерия Николаевна",   pn: "407", dept: itDep,   pos: "Системный администратор",                          sched: sched8,    hire: "2023-10-01", pattern: "many_sick" },      // АНОМАЛИЯ
    { fullName: "Тихонов Вадим Юрьевич",           pn: "408", dept: itDep,   pos: "Инженер-программист встраиваемых систем",          sched: sched8,    hire: "2017-03-20", pattern: "normal" },
    { fullName: "Куликова Наталья Анатольевна",   pn: "409", dept: itDep,   pos: "Инженер САПР",                                     sched: sched8,    hire: "2015-12-08", pattern: "normal" },
    { fullName: "Ершов Максим Дмитриевич",         pn: "410", dept: itDep,   pos: "Программист АСУ ТП",                               sched: sched8,    hire: "2024-01-10", pattern: "on_vacation" },   // Весь февраль в отпуске

    // === ОТК ===
    { fullName: "Новикова Елена Александровна",    pn: "501", dept: otk,     pos: "Контролёр ОТК (электроника)",                      sched: sched8,    hire: "2018-04-05", pattern: "normal" },
    { fullName: "Рогов Сергей Михайлович",         pn: "502", dept: otk,     pos: "Контролёр ОТК (электроника)",                      sched: sched8,    hire: "2020-06-14", pattern: "many_absent" },   // АНОМАЛИЯ
    { fullName: "Антонова Галина Петровна",        pn: "503", dept: otk,     pos: "Инженер по качеству",                              sched: sched8,    hire: "2012-09-01", pattern: "normal" },
    { fullName: "Власов Евгений Романович",        pn: "504", dept: otk,     pos: "Контролёр ОТК (электроника)",                      sched: sched8,    hire: "2021-07-19", pattern: "normal" },
    { fullName: "Соловьёва Оксана Игоревна",      pn: "505", dept: otk,     pos: "Инженер по качеству",                              sched: sched8,    hire: "2016-11-25", pattern: "normal" },

    // === ОТДЕЛ СНАБЖЕНИЯ ===
    { fullName: "Карпов Илья Сергеевич",           pn: "601", dept: zakupki, pos: "Специалист по закупкам (компоненты)",               sched: sched8,    hire: "2017-02-01", pattern: "business_trips" }, // АНОМАЛИЯ: командировки
    { fullName: "Ларина Марина Аркадьевна",        pn: "602", dept: zakupki, pos: "Специалист по закупкам (компоненты)",               sched: sched8,    hire: "2020-05-18", pattern: "normal" },
    { fullName: "Митрофанов Вячеслав Иванович",   pn: "603", dept: zakupki, pos: "Кладовщик склада комплектующих",                   sched: sched8,    hire: "2019-08-12", pattern: "many_sick" },      // АНОМАЛИЯ
    { fullName: "Зубова Алина Дмитриевна",         pn: "604", dept: zakupki, pos: "Кладовщик склада комплектующих",                   sched: sched8,    hire: "2023-01-09", pattern: "normal" },

    // === БУХГАЛТЕРИЯ ===
    { fullName: "Лебедева Ольга Игоревна",         pn: "701", dept: buh,     pos: "Бухгалтер",                                        sched: sched8,    hire: "2013-08-19", pattern: "normal" },
    { fullName: "Кузнецов Сергей Павлович",        pn: "702", dept: buh,     pos: "Бухгалтер",                                        sched: sched8,    hire: "2017-03-01", pattern: "normal", isActive: false },
    { fullName: "Алексеева Вера Николаевна",       pn: "703", dept: buh,     pos: "Бухгалтер",                                        sched: sched8,    hire: "2021-10-04", pattern: "normal" },
  ];

  // === Создание сотрудников ===
  const createdEmps: Array<{ id: string; pn: string }> = [];
  for (const def of empDefs) {
    const posId = posMap.get(def.pos) ?? posMap.get("Монтажник РЭА")!;
    const emp = await prisma.employee.create({
      data: {
        fullName: def.fullName,
        position: def.pos,
        departmentId: def.dept.id,
        personnelNumber: def.pn,
        scheduleId: def.sched.id,
        positionId: posId,
        hireDate: new Date(def.hire),
        isActive: def.isActive !== false,
      },
    });
    createdEmps.push({ id: emp.id, pn: def.pn });
  }

  // === Совместитель: Иванов (101) числится ещё в ОТК ===
  const ivanovId = createdEmps.find((e) => e.pn === "101")!.id;
  const ivanovOtk = await prisma.employee.create({
    data: {
      fullName: "Иванов Иван Иванович",
      position: "Контролёр (совместитель)",
      departmentId: otk.id,
      personnelNumber: "101-С",
      scheduleId: sched8.id,
      linkedEmployeeId: ivanovId,
      positionId: posMap.get("Контролёр (совместитель)")!,
      hireDate: new Date("2015-03-15"),
    },
  });
  await prisma.employee.update({ where: { id: ivanovId }, data: { linkedEmployeeId: ivanovOtk.id } });

  // === Заполнение табеля: февраль 2026 ===
  for (let i = 0; i < empDefs.length; i++) {
    const def = empDefs[i];
    if (def.isActive === false) continue; // уволенные пропускаем

    const empId = createdEmps[i].id;
    const records = buildFebruaryMarks(empId, def.pattern, markMap, def.weekendWorker);
    for (const rec of records) {
      await prisma.timeRecord.create({ data: rec });
    }
  }

  // Совместитель Иванов в ОТК — нормальный паттерн (slot=1)
  const ivanovOtkRecords = buildFebruaryMarks(ivanovOtk.id, "normal", markMap, false);
  for (const rec of ivanovOtkRecords) {
    await prisma.timeRecord.create({ data: { ...rec, slot: 0 } });
  }

  console.log("✅ Seed завершён успешно!");
  console.log(`- 7 подразделений (IT-завод)`);
  console.log(`- 4 графика работы`);
  console.log(`- ${positionData.length} должностей`);
  console.log(`- ${empDefs.length + 1} сотрудников (включая совместителя)`);
  console.log(`- 6 типов отметок`);
  console.log(`- ${holidays2026.length} праздничных дней`);
  console.log(`- 10 системных пользователей`);
  console.log(`- Табель заполнен за февраль 2026 с аномалиями`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
