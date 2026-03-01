# Табель учёта рабочего времени — ТАНТК им. Бериева

Цифровая система учёта рабочего времени для производственных предприятий. Разработана на хакатоне.

## Стек

- **Next.js 16** (App Router) + TypeScript
- **Prisma 6** + SQLite
- **NextAuth v5** — JWT-сессии с ролевой моделью
- **Tailwind CSS** + shadcn/ui

## Роли

| Роль | Доступ |
|------|--------|
| ADMIN | Полный доступ, настройки, пользователи |
| MANAGER | Табель и сотрудники только своего подразделения |
| ACCOUNTANT | Только чтение, экспорт отчётов |
| HR | Просмотр данных по всем сотрудникам |

## Демо-аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| Администратор | sokolov.dmitry@tantk.ru | Beriev@2026 |
| Менеджер (отдел 1) | vasiliev.oleg@tantk.ru | Ceh1Master! |
| Менеджер (отдел 2) | zaharov.roman@tantk.ru | Ceh2Master! |
| Бухгалтер | petrova.marina@tantk.ru | Buhgalter1! |
| Специалист ОК | smirnova.elena@tantk.ru | HrOtdel2026! |

## Запуск локально

```bash
pnpm install
pnpm prisma migrate deploy
pnpm prisma db seed
pnpm dev
```

## Деплой на Railway

### 1. Переменные окружения

В настройках сервиса добавить:

```
DATABASE_URL=file:/app/data/dev.db
AUTH_SECRET=<случайная строка 32+ символа>
NEXTAUTH_URL=https://<ваш-домен>.railway.app
```

> Для `AUTH_SECRET` можно сгенерировать: `openssl rand -base64 32`

### 2. Volume для БД

SQLite хранит данные в файле. Чтобы они не терялись при редеплое:

1. Railway → ваш сервис → **Volumes** → Add Volume
2. Mount path: `/app/data`
3. Обновить `DATABASE_URL`: `file:/app/data/dev.db`

### 3. Build & Start команды

Railway автоматически определит Next.js. Если нужно указать вручную:

- **Build command:** `pnpm install && pnpm prisma migrate deploy && pnpm prisma db seed && pnpm build`
- **Start command:** `pnpm start`

### 4. Порт

Railway проксирует на порт `3000` автоматически (Next.js default).

---

> **Примечание:** SQLite подходит для демонстрации и небольших нагрузок. Для продакшена рекомендуется заменить на PostgreSQL — достаточно поменять `provider` в `prisma/schema.prisma` и `DATABASE_URL`.
