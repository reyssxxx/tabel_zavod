# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Employee timesheet tracking web app for a 3000+ employee manufacturing enterprise (АО "ТАНТК им. Г.М. Бериева"). Russian-language UI. Built for a hackathon — prioritize feature completeness over design polish.

## Commands

```bash
pnpm dev              # Start dev server (Turbopack) on localhost:3000
pnpm build            # Production build
pnpm lint             # ESLint
npx prisma migrate dev --name <name>  # Create and apply migration
npx prisma db seed    # Seed database (10 employees, 6 departments, 3 users, holidays)
npx prisma studio     # Visual DB editor on localhost:5555
```

## Architecture

**Stack**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui + Prisma 6 + SQLite + NextAuth v5 (beta)

### Routing structure
- `src/app/layout.tsx` — root layout with SessionProvider
- `src/app/auth/login/page.tsx` — login page (standalone, no sidebar)
- `src/app/(dashboard)/layout.tsx` — authenticated layout with sidebar + header
- `src/app/(dashboard)/` — all authenticated pages (employees, timesheet, reports, settings)
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth API handler

### Auth & roles
Session (JWT) carries `role` and `departmentId` beyond standard NextAuth fields. Three roles:
- **ADMIN** — full access, all departments
- **MANAGER** — edit only their own department (filtered by `departmentId`)
- **ACCOUNTANT** — read-only everywhere

Use `getCurrentUser()` / `requireRole()` / `canEditDepartment()` from `src/lib/auth-utils.ts` in API routes. Client-side: `useSession()` from next-auth/react, cast `session.user` to access `role` and `departmentId`.

Demo role switcher in header re-authenticates as different preset users.

### Database (Prisma + SQLite)
Schema in `prisma/schema.prisma`. Key models: User, Department, Employee, MarkType (Я/ОТ/Б/К/П/С attendance codes), TimeRecord (unique on [employeeId, date]), Holiday.

SQLite DB file at `prisma/dev.db`. Prisma client singleton in `src/lib/db.ts`.

### Key shared utilities
- `src/lib/constants.ts` — MONTHS (Russian), ROLE_LABELS, WORK_HOURS_PER_DAY
- `src/lib/holidays.ts` — cached holiday lookup, `isWeekend()`, `formatDateKey()`
- `src/types/index.ts` — shared TypeScript interfaces (SessionUser, EmployeeWithDepartment, TimesheetRow, ReportData, etc.)

### UI components
shadcn/ui components in `src/components/ui/`. App-level components (app-sidebar, app-header, providers) in `src/components/`.

### Module specifications
Detailed specs for unimplemented modules live in `docs/prompts/`:
- `employees-module.md` — CRUD, search/filter, CSV import
- `timesheet-module.md` — monthly grid with inline editing, color-coded cells
- `reports-module.md` — department metrics, Excel/CSV/TXT export

## Test accounts
| Email | Password | Role |
|---|---|---|
| admin@tabel.ru | admin123 | ADMIN |
| master@tabel.ru | master123 | MANAGER (Цех №1) |
| buh@tabel.ru | buh123 | ACCOUNTANT |

## Conventions
- All user-facing text in Russian
- API month parameters are 0-indexed (0=January) for JS Date compatibility
- Dates in TimeRecord use DateTime but only the date portion matters (time is 00:00:00)
- Employee deletion is soft-delete (`isActive = false`)
- Export libraries: `xlsx` (SheetJS) for Excel, `csv-stringify` for CSV
