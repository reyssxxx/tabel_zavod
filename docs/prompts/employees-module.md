# Модуль: Справочник сотрудников

## Контекст проекта
- Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, Prisma + SQLite
- Auth: NextAuth.js (session содержит role и departmentId)
- Роли: ADMIN (полный доступ), MANAGER (своё подразделение), ACCOUNTANT (только чтение)
- Route group: все страницы в `src/app/(dashboard)/`

## Существующие файлы (НЕ трогать)
- `src/lib/db.ts` — Prisma client singleton
- `src/lib/auth.ts` — NextAuth config
- `src/lib/auth-utils.ts` — getCurrentUser(), requireRole(), canEditDepartment(), canEdit()
- `src/types/index.ts` — типы (EmployeeWithDepartment, DepartmentOption, Role)
- `src/components/ui/*` — shadcn компоненты (button, input, label, select, table, dialog, dropdown-menu, card, badge, separator, sheet, sonner, tabs, avatar)
- `prisma/schema.prisma` — схема БД

## Файлы для создания

### API Routes
1. `src/app/api/employees/route.ts`
   - GET: список сотрудников с фильтрами (query params: search, department, showInactive, page, pageSize)
     - search — поиск по fullName и personnelNumber (LIKE)
     - department — фильтр по departmentId
     - showInactive — boolean, по умолчанию false (показывать только isActive=true)
     - page, pageSize — пагинация, по умолчанию page=1, pageSize=20
     - Возвращает: { employees: EmployeeWithDepartment[], total: number, page: number, pageSize: number }
     - MANAGER видит только сотрудников своего подразделения
   - POST: создание сотрудника
     - Body: { fullName, position, departmentId, personnelNumber }
     - Валидация: обязательные поля, уникальность personnelNumber
     - Только ADMIN и MANAGER (MANAGER — только своё подразделение)

2. `src/app/api/employees/[id]/route.ts`
   - GET: один сотрудник по id (с department)
   - PUT: обновление сотрудника
     - Body: { fullName?, position?, departmentId?, personnelNumber?, isActive? }
     - Только ADMIN и MANAGER (MANAGER — только если сотрудник в его подразделении)
   - DELETE: деактивация (isActive = false), не реальное удаление
     - Только ADMIN и MANAGER

3. `src/app/api/employees/import/route.ts`
   - POST: импорт из CSV
     - Принимает FormData с файлом
     - Ожидаемые колонки CSV: ФИО, Должность, Подразделение, Табельный номер
     - Подразделение матчится по имени (Department.name), если не найдено — ошибка
     - Возвращает: { imported: number, errors: string[] }
     - Только ADMIN

4. `src/app/api/departments/route.ts`
   - GET: список всех подразделений ({ id, name })

### Страницы
5. `src/app/(dashboard)/employees/page.tsx`
   - Клиентский компонент ("use client")
   - Состояния: search (string), departmentFilter (string), showInactive (boolean), page (number)
   - Запрос данных: fetch `/api/employees?...` при изменении фильтров (useEffect + debounce для search)
   - Запрос подразделений: fetch `/api/departments` при монтировании
   - Верхняя панель:
     - Input для поиска (placeholder: "Поиск по ФИО или табельному номеру")
     - Select для подразделения (значение "all" = все)
     - Checkbox/toggle "Показать неактивных"
     - Кнопка "Добавить" (скрыта для ACCOUNTANT) — открывает диалог
     - Кнопка "Импорт CSV" (только ADMIN) — открывает диалог импорта
   - Таблица (shadcn Table):
     - Колонки: ФИО, Должность, Подразделение, Таб. №, Статус (Badge: зелёный=активен, серый=неактивен), Действия
     - Действия: кнопка редактирования (opens dialog), кнопка деактивации (с confirm)
     - Скрыть действия для ACCOUNTANT
     - MANAGER видит действия только для своего подразделения
   - Пагинация внизу: "Показано X из Y" + кнопки назад/вперёд

### Компоненты
6. `src/components/employee-form.tsx`
   - Props: { employee?: EmployeeWithDepartment, departments: DepartmentOption[], onSuccess: () => void, onCancel: () => void }
   - Форма внутри Dialog:
     - ФИО (Input, required)
     - Должность (Input, required)
     - Подразделение (Select из departments, required)
     - Табельный номер (Input, required)
   - При submit: POST /api/employees (создание) или PUT /api/employees/[id] (редактирование)
   - Обработка ошибок: показать toast (sonner) при ошибке, закрыть dialog при успехе
   - Вызвать onSuccess для перезагрузки списка

7. `src/components/csv-import-dialog.tsx`
   - Props: { departments: DepartmentOption[], onSuccess: () => void }
   - Шаги:
     1. Загрузка файла (input type="file" accept=".csv")
     2. Preview: таблица с распознанными данными
     3. Кнопка "Импортировать" → POST /api/employees/import
   - Показать результат: сколько импортировано, какие ошибки
   - CSV парсинг на клиенте: разделитель ";" или ",", кодировка UTF-8

## Важные детали
- Все API должны проверять сессию через getCurrentUser() из auth-utils
- Ответы API: JSON, коды 200/201/400/401/403/404
- Используй toast из sonner для уведомлений пользователя
- Debounce поиска: 300ms
- Текст на русском языке
