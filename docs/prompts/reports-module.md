# Модуль: Отчёты и экспорт

## Контекст проекта
- Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, Prisma + SQLite
- Auth: NextAuth.js (session содержит role и departmentId)
- Роли: ADMIN (полный доступ), MANAGER (своё подразделение), ACCOUNTANT (только чтение)
- Route group: все страницы в `src/app/(dashboard)/`
- Библиотеки для экспорта: `xlsx` (SheetJS), `csv-stringify`

## Существующие файлы (НЕ трогать)
- `src/lib/db.ts` — Prisma client singleton
- `src/lib/auth-utils.ts` — getCurrentUser(), requireRole()
- `src/lib/constants.ts` — MONTHS, WORK_HOURS_PER_DAY, MARK_TYPE_LABELS
- `src/lib/holidays.ts` — loadHolidays(), isWeekend(), formatDateKey()
- `src/types/index.ts` — типы (ReportData, MarkTypeOption, DepartmentOption)
- `src/components/ui/*` — shadcn компоненты
- `src/app/api/departments/route.ts` — GET список подразделений

## Файлы для создания

### Утилиты
1. `src/lib/export.ts`
   - `generateTimesheetXlsx(data, month, year, departmentName)` → Buffer
     - Создаёт Excel файл с помощью xlsx (SheetJS)
     - Лист "Табель":
       - Заголовок: "Табель учёта рабочего времени за {месяц} {год} — {подразделение}"
       - Таблица: ФИО | 1 | 2 | ... | N | Дни | Часы
       - Ячейки с отметками — залиты цветом markType
       - Выходные колонки — серый фон
     - Возвращает Buffer для отдачи клиенту
   - `generateTimesheetCsv(data, month, year)` → string
     - CSV с разделителем ";"
     - Колонки: ФИО;1;2;...;N;Дни;Часы
     - Кодировка: UTF-8 с BOM (для корректного открытия в Excel)
   - `generateReportTxt(reportData: ReportData[], month, year)` → string
     - Текстовый отчёт:
       ```
       ОТЧЁТ ПО ПОДРАЗДЕЛЕНИЯМ
       За {месяц} {год}
       ===========================

       Подразделение: Цех №1
       Сотрудников: 5
       Дней явки: 100
       Дней отпуска: 10
       Дней больничного: 5
       Командировок: 3
       Прогулов: 0
       Сокращённых дней: 2
       ---------------------------
       ...
       ```

### API Routes
2. `src/app/api/reports/route.ts`
   - GET: агрегированные данные отчёта
     - Query params: year (number), month (number, 0-indexed), departmentId? (string, "all" = все)
     - Логика:
       1. Определить период (startDate, endDate)
       2. Получить подразделения (все или одно)
       3. Для каждого подразделения:
          - Подсчитать активных сотрудников
          - Подсчитать записи TimeRecord за период, сгруппированные по markType.code
          - Сформировать ReportData
       4. MANAGER: только своё подразделение
     - Возвращает: { reports: ReportData[] }

3. `src/app/api/export/timesheet/route.ts`
   - GET: экспорт табеля
     - Query params: year, month, departmentId, format ("xlsx" | "csv")
     - Получить данные (аналогично GET /api/timerecords)
     - Вызвать соответствующую функцию из export.ts
     - Вернуть файл:
       - xlsx: Content-Type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
       - csv: Content-Type text/csv; charset=utf-8
     - Content-Disposition: attachment; filename="tabel_{month}_{year}.{ext}"

4. `src/app/api/export/report/route.ts`
   - GET: экспорт отчёта в TXT
     - Query params: year, month, departmentId
     - Получить ReportData (аналогично GET /api/reports)
     - Вызвать generateReportTxt()
     - Вернуть: Content-Type text/plain; charset=utf-8
     - Content-Disposition: attachment; filename="report_{month}_{year}.txt"

### Страница
5. `src/app/(dashboard)/reports/page.tsx`
   - Клиентский компонент ("use client")
   - Состояния: year, month, departmentId
   - При изменении фильтров: fetch `/api/reports?...`
   - Верхняя панель:
     - Select: месяц, год, подразделение (аналогично табелю)
     - Кнопки экспорта: "Excel", "CSV", "TXT" (ExportButtons)
   - Основная часть:
     - Если departmentId === "all" — карточки для каждого подразделения
     - Если выбрано конкретное — одна карточка
     - Карточка (ReportCard): метрики подразделения

### Компоненты
6. `src/components/report-filters.tsx`
   - Props: { year, month, departmentId, departments, onChange: ({year, month, departmentId}) => void, userRole }
   - Select для месяца, года, подразделения
   - MANAGER: подразделение зафиксировано

7. `src/components/report-card.tsx`
   - Props: { data: ReportData }
   - Card (shadcn) с метриками:
     - Заголовок: название подразделения
     - Сетка (grid 2-3 колонки):
       - Сотрудников: {totalEmployees}
       - Дней явки: {workDays} (зелёный)
       - Отпуск: {vacationDays} (синий)
       - Больничный: {sickDays} (красный)
       - Командировки: {businessTripDays} (жёлтый)
       - Прогулы: {absentDays} (тёмно-красный)
       - Сокр. дни: {shortenedDays} (фиолетовый)
     - Цвета совпадают с цветами MarkType из БД

8. `src/components/export-buttons.tsx`
   - Props: { year: number, month: number, departmentId: string, type: "timesheet" | "report" }
   - Для type="timesheet":
     - Кнопка "Excel" → GET /api/export/timesheet?format=xlsx&...
     - Кнопка "CSV" → GET /api/export/timesheet?format=csv&...
   - Для type="report":
     - Кнопка "TXT" → GET /api/export/report?...
   - При клике: fetch → blob → download (создать <a> с URL.createObjectURL)
   - Показать loading состояние на кнопке

## Важные детали
- Месяц в API передаётся 0-indexed (0=январь)
- Excel файл: использовать xlsx.utils.aoa_to_sheet для создания листа из массива массивов
- CSV: BOM (\uFEFF) в начале для корректного отображения кириллицы в Excel
- Все кнопки экспорта доступны всем ролям (это чтение, не запись)
- Текст на русском языке
