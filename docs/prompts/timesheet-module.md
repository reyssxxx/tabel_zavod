# Модуль: Табель учёта рабочего времени

## Контекст проекта
- Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, Prisma + SQLite
- Auth: NextAuth.js (session содержит role и departmentId)
- Роли: ADMIN (полный доступ), MANAGER (своё подразделение), ACCOUNTANT (только чтение)
- Route group: все страницы в `src/app/(dashboard)/`

## Существующие файлы (НЕ трогать)
- `src/lib/db.ts` — Prisma client singleton
- `src/lib/auth.ts` — NextAuth config
- `src/lib/auth-utils.ts` — getCurrentUser(), requireRole(), canEditDepartment(), canEdit()
- `src/lib/constants.ts` — MONTHS, WORK_HOURS_PER_DAY, ROLE_LABELS
- `src/lib/holidays.ts` — loadHolidays(), isWeekend(), formatDateKey()
- `src/types/index.ts` — типы (TimesheetRow, TimeRecordData, MarkTypeOption, SessionUser)
- `src/components/ui/*` — shadcn компоненты
- `src/app/api/departments/route.ts` — GET список подразделений (создаётся в модуле employees)

## Файлы для создания

### API Routes
1. `src/app/api/timerecords/route.ts`
   - GET: записи за период
     - Query params: year (number), month (number, 0-indexed), departmentId? (string)
     - Логика:
       1. Определить startDate и endDate месяца
       2. Получить сотрудников (фильтр по department если указан, только isActive=true)
       3. Получить все TimeRecord за период для этих сотрудников (include markType)
       4. Получить holidays за период через loadHolidays()
       5. Получить все MarkType
       6. Сформировать ответ: { rows: TimesheetRow[], markTypes: MarkTypeOption[], holidays: Record<string, {name: string, isShortened: boolean}>, daysInMonth: number }
     - Для каждого сотрудника: создать объект records (day -> data), подсчитать totalDays и totalHours
     - MANAGER: автоматически фильтровать по своему departmentId
   - PUT: upsert одной записи
     - Body: { employeeId: string, date: string (ISO), markTypeId: string | null }
     - Если markTypeId === null — удалить запись (если она есть)
     - Иначе — upsert (создать или обновить) по @@unique([employeeId, date])
     - Проверка роли: ACCOUNTANT — 403, MANAGER — только свои сотрудники
     - Вернуть обновлённую запись

2. `src/app/api/timerecords/bulk/route.ts`
   - POST: массовое заполнение
     - Body: { entries: Array<{ employeeId: string, date: string, markTypeId: string }> }
     - Для каждого entry — upsert
     - Проверка роли аналогично PUT
     - Вернуть { updated: number }

3. `src/app/api/mark-types/route.ts`
   - GET: список всех типов отметок ({ id, code, name, defaultHours, color })

### Страница
4. `src/app/(dashboard)/timesheet/page.tsx`
   - Клиентский компонент ("use client")
   - Состояния: year, month (по умолчанию — текущий), departmentId
   - При изменении фильтров: fetch `/api/timerecords?year=&month=&departmentId=`
   - Верхняя панель (TimesheetFilters):
     - Select: месяц (из MONTHS)
     - Select: год (текущий ± 2)
     - Select: подразделение (все / конкретное). MANAGER — только своё, Select скрыт
   - Основная часть: TimesheetGrid
   - Получить session через useSession() для определения role

### Компоненты
5. `src/components/timesheet-filters.tsx`
   - Props: { year, month, departmentId, departments, onYearChange, onMonthChange, onDepartmentChange, userRole }
   - Select для месяца, года, подразделения
   - MANAGER: подразделение зафиксировано, select disabled или скрыт

6. `src/components/timesheet-grid.tsx`
   - Props: { rows: TimesheetRow[], markTypes: MarkTypeOption[], holidays: Record<string, ...>, daysInMonth: number, year: number, month: number, canEdit: boolean, userDepartmentId: string | null, userRole: string, onCellUpdate: (employeeId: string, day: number, markTypeId: string | null) => void }
   - Рендерит HTML таблицу (НЕ shadcn Table — нужен полный контроль стилей):
     - Заголовок: "Сотрудник" | 1 | 2 | ... | N | "Дни" | "Часы"
     - Подсветка заголовков колонок:
       - Выходные (сб/вс) — bg-gray-100 text-gray-400
       - Праздники — bg-orange-50 text-orange-600
       - Предпраздничные — bg-yellow-50
     - Строки: ФИО (sticky left) | ячейки | итоги
   - CSS:
     - Таблица: `overflow-x-auto` на контейнере
     - Первая колонка: `position: sticky; left: 0; z-index: 10; background: white;`
     - Ячейки: `min-width: 36px; text-align: center;`
   - Каждая ячейка: TimesheetCell

7. `src/components/timesheet-cell.tsx`
   - Props: { value: TimeRecordData | null, markTypes: MarkTypeOption[], canEdit: boolean, isWeekend: boolean, isHoliday: boolean, onSelect: (markTypeId: string | null) => void }
   - Отображение:
     - Пустая ячейка — "-" (или пусто)
     - С отметкой — код (Я, ОТ, Б...) с фоновым цветом markType.color (с opacity 20%)
     - Выходной/праздник без отметки — серый/оранжевый фон
   - При клике (если canEdit):
     - Открыть DropdownMenu с вариантами:
       - Каждый MarkType: цветная точка + код + название
       - Разделитель
       - "Очистить" — вызвать onSelect(null)
     - При выборе — вызвать onSelect(markTypeId)
   - Если !canEdit — клик не работает, курсор default

8. `src/components/timesheet-summary.tsx` (опционально, можно встроить в grid)
   - Итоговая строка внизу таблицы или отдельный блок
   - Суммарно по всем сотрудникам: общее количество дней и часов

## Важные детали
- Месяц в API передаётся 0-indexed (0=январь) для совместимости с JS Date
- Дата в TimeRecord хранится как DateTime, но используется только date-часть (время 00:00:00)
- При upsert отметки — отправлять запрос PUT /api/timerecords, не ждать ответа для обновления UI (optimistic update)
- Цвет ячейки: используй markType.color с opacity ~20% для фона (`background: ${color}33`)
- Ячейки в таблице должны быть компактными (36-40px ширина) чтобы 31 день поместился
- Текст на русском языке
