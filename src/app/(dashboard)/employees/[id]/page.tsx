"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmployeeForm } from "@/components/employee-form";
import { TimesheetGrid } from "@/components/timesheet-grid";
import {
  ArrowLeft,
  Pencil,
  UserX,
  CalendarDays,
  Clock,
  TrendingUp,
  AlertTriangle,
  User,
  Building2,
  Hash,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { MONTHS } from "@/lib/constants";
import { formatRub } from "@/lib/salary";
import type { EmployeeWithDepartment, DepartmentOption, SessionUser, TimesheetRow, MarkTypeOption, SalaryBreakdown } from "@/types";

interface EmployeeStats {
  currentMonth: {
    year: number;
    month: number;
    byCode: Record<string, number>;
    totalHours: number;
    totalOvertimeHours: number;
    totalRecords: number;
  };
  allTime: {
    totalRecords: number;
    totalHours: number;
    totalOvertimeHours: number;
    byCode: Record<string, number>;
    firstRecordDate: string | null;
    lastRecordDate: string | null;
  };
  recentRecords: { date: string; markCode: string; markColor: string; markName: string; hours: number }[];
  linked: { id: string; fullName: string; position: string; personnelNumber: string; departmentName: string }[];
  combinedHours: number | null;
  combinedOT: number | null;
}

interface TimesheetData {
  rows: TimesheetRow[];
  markTypes: MarkTypeOption[];
  holidays: Record<string, { name: string; isShortened: boolean }>;
  daysInMonth: number;
}

const MARK_LABELS: Record<string, string> = {
  Я: "Явка",
  ОТ: "Отпуск",
  Б: "Больничный",
  К: "Командировка",
  П: "Прогул",
  С: "Сокращённый",
};

const MARK_COLORS: Record<string, string> = {
  Я: "bg-green-100 text-green-800 border-green-200",
  ОТ: "bg-blue-100 text-blue-800 border-blue-200",
  Б: "bg-red-100 text-red-800 border-red-200",
  К: "bg-amber-100 text-amber-800 border-amber-200",
  П: "bg-red-200 text-red-900 border-red-300",
  С: "bg-purple-100 text-purple-800 border-purple-200",
};

function getWorkingDaysInMonth(year: number, month: number): number {
  const days = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatSinceDate(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return `${diffDays} дн.`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} мес.`;
  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;
  return months > 0 ? `${years} г. ${months} мес.` : `${years} г.`;
}

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`text-3xl font-bold tabular-nums ${accent ?? "text-foreground"}`}>
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <div className="rounded-lg bg-muted p-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const role = user?.role;

  const isAccountant = role === "ACCOUNTANT";
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";

  const now = new Date();

  const [employee, setEmployee] = useState<EmployeeWithDepartment | null>(null);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Зарплата
  const [salary, setSalary] = useState<(SalaryBreakdown & { positionName?: string; normWorkdays?: number; year?: number; month?: number; otCoef1?: number; otCoef2?: number; otThreshold?: number; weekendCoef?: number; holidayCoef?: number }) | null>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);

  // Табель + выбранный месяц (управляет и зарплатой, и табелем)
  const [tsYear, setTsYear] = useState(now.getFullYear());
  const [tsMonth, setTsMonth] = useState(now.getMonth());
  const [tsData, setTsData] = useState<TimesheetData | null>(null);
  const [tsLoading, setTsLoading] = useState(false);

  // Загружаем данные сотрудника и статистику за всё время
  useEffect(() => {
    if (!id) return;

    setEmpLoading(true);
    fetch(`/api/employees/${id}`)
      .then((r) => {
        if (!r.ok) { router.replace("/employees"); return null; }
        return r.json();
      })
      .then((data) => { if (data) setEmployee(data); })
      .catch(() => { toast.error("Ошибка загрузки данных"); router.replace("/employees"); })
      .finally(() => setEmpLoading(false));

    setStatsLoading(true);
    fetch(`/api/employees/${id}/stats`)
      .then((r) => r.json())
      .then((data: EmployeeStats) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [id, router]);

  // Перезагружаем зарплату при смене месяца
  useEffect(() => {
    if (!id) return;
    setSalaryLoading(true);
    const salaryParams = new URLSearchParams({ year: String(tsYear), month: String(tsMonth) });
    fetch(`/api/employees/${id}/salary?${salaryParams}`)
      .then((r) => r.json())
      .then((data) => setSalary(data))
      .catch(() => setSalary(null))
      .finally(() => setSalaryLoading(false));
  }, [id, tsYear, tsMonth]);

  // Подразделения для формы редактирования
  useEffect(() => {
    if (!role) return;
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setDepartments(data); })
      .catch(() => {});
  }, [role]);

  // Загрузка табеля по сотруднику
  const fetchTimesheet = useCallback(async () => {
    if (!id) return;
    setTsLoading(true);
    try {
      const params = new URLSearchParams({ year: String(tsYear), month: String(tsMonth), employeeId: id });
      const res = await fetch(`/api/timerecords?${params}`);
      if (res.ok) setTsData(await res.json());
    } catch { /* ignore */ }
    finally { setTsLoading(false); }
  }, [id, tsYear, tsMonth]);

  useEffect(() => { fetchTimesheet(); }, [fetchTimesheet]);

  const handleDeactivate = async () => {
    if (!employee) return;
    if (!confirm(`Деактивировать сотрудника "${employee.fullName}"?`)) return;
    try {
      const res = await fetch(`/api/employees/${employee.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Ошибка деактивации");
        return;
      }
      toast.success(`Сотрудник "${employee.fullName}" деактивирован`);
      setEmployee((prev) => prev ? { ...prev, isActive: false } : prev);
    } catch {
      toast.error("Ошибка соединения с сервером");
    }
  };

  const handleCellUpdate = async (employeeId: string, day: number, markTypeId: string | null, slot = 0, overtimeHours = 0, actualHours: number | null = null) => {
    const dateStr = `${tsYear}-${String(tsMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    try {
      const res = await fetch("/api/timerecords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, date: `${dateStr}T00:00:00.000Z`, markTypeId, slot, overtimeHours, actualHours }),
      });
      if (res.ok) fetchTimesheet();
    } catch { toast.error("Ошибка сохранения"); }
  };

  const canEdit = (): boolean => {
    if (!employee) return false;
    if (isAccountant) return false;
    if (isAdmin) return true;
    if (isManager) return employee.department.id === user?.departmentId;
    return false;
  };

  // Статистика за выбранный месяц вычисляется из данных табеля
  const monthlyByCode: Record<string, number> = {};
  let monthlyTotalHours = 0;
  let monthlyTotalOT = 0;
  let monthlyTotalRecords = 0;
  if (tsData) {
    for (const row of tsData.rows) {
      for (const rec of Object.values(row.records)) {
        if (rec.markCode) {
          monthlyByCode[rec.markCode] = (monthlyByCode[rec.markCode] ?? 0) + 1;
          monthlyTotalRecords++;
        }
      }
      monthlyTotalHours += row.totalHours;
      monthlyTotalOT += row.totalOvertimeHours;
    }
  }

  const workingDays = getWorkingDaysInMonth(tsYear, tsMonth);
  const filledPercent = workingDays > 0
    ? Math.round((monthlyTotalRecords / workingDays) * 100)
    : 0;

  if (empLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Загрузка...
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Навигация */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
          <Link href="/employees">
            <ArrowLeft className="h-4 w-4" />
            Сотрудники
          </Link>
        </Button>
      </div>

      {/* Шапка профиля */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">{employee.fullName}</h1>
              <p className="text-muted-foreground">{employee.position}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pl-0 sm:pl-15">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {employee.department.name}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              Таб. {employee.personnelNumber}
            </span>
            {employee.isActive ? (
              <Badge className="bg-green-500 hover:bg-green-600 text-white">Активен</Badge>
            ) : (
              <Badge variant="secondary">Неактивен</Badge>
            )}
            {stats && stats.linked.length > 0 && (
              <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                Совместитель
              </Badge>
            )}
          </div>

          {/* Связанные записи совместителя */}
          {stats && stats.linked.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-amber-700 font-medium">Также работает как:</span>
              {stats.linked.map((l) => (
                <Link
                  key={l.id}
                  href={`/employees/${l.id}`}
                  className="text-amber-800 underline underline-offset-2 hover:text-amber-900"
                >
                  {l.fullName} — {l.position} ({l.departmentName}, №{l.personnelNumber})
                </Link>
              ))}
            </div>
          )}
        </div>

        {canEdit() && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowEditDialog(true)}
            >
              <Pencil className="h-4 w-4" />
              Редактировать
            </Button>
            {employee.isActive && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={handleDeactivate}
              >
                <UserX className="h-4 w-4" />
                Деактивировать
              </Button>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Статистика */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Загрузка статистики...
        </div>
      ) : stats ? (
        <div className="space-y-8">

          {/* Навигатор месяца */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Данные за месяц
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (tsMonth === 0) { setTsMonth(11); setTsYear((y) => y - 1); }
                  else setTsMonth((m) => m - 1);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-28 text-center">
                {MONTHS[tsMonth]} {tsYear}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (tsMonth === 11) { setTsMonth(0); setTsYear((y) => y + 1); }
                  else setTsMonth((m) => m + 1);
                }}
                disabled={tsYear === now.getFullYear() && tsMonth === now.getMonth()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Отметки за выбранный месяц */}
          <section>
            {/* Прогресс-бар */}
            <div className="mb-5 rounded-xl border bg-card p-4">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-medium">Заполненность табеля</span>
                <span className="text-sm text-muted-foreground">
                  {monthlyTotalRecords} / {workingDays} рабочих дней ({filledPercent}%)
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(filledPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Карточки месяца */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(["Я", "ОТ", "Б", "К", "П", "С"] as const).map((code) => {
                const count = monthlyByCode[code] ?? 0;
                return (
                  <div
                    key={code}
                    className={`rounded-xl border p-3 text-center transition-opacity ${
                      count === 0 ? "opacity-40" : ""
                    } ${MARK_COLORS[code] ?? "bg-muted"}`}
                  >
                    <div className="text-2xl font-bold tabular-nums">{count}</div>
                    <div className="text-xs mt-0.5 font-medium">{code}</div>
                    <div className="text-xs mt-0.5 opacity-70">{MARK_LABELS[code]}</div>
                  </div>
                );
              })}
            </div>

            {/* Итого часов за месяц */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <StatCard
                label={`Итого часов — ${MONTHS[tsMonth]}`}
                value={tsLoading ? "..." : monthlyTotalHours}
                sub="по графику"
                icon={Clock}
              />
              {monthlyTotalOT > 0 && (
                <StatCard
                  label="Сверхурочные"
                  value={`+${monthlyTotalOT} ч`}
                  sub="переработка сверх графика"
                  accent="text-red-600"
                  icon={TrendingUp}
                />
              )}
              {stats?.combinedHours !== null && tsYear === now.getFullYear() && tsMonth === now.getMonth() && (
                <StatCard
                  label="Суммарно по обеим должностям"
                  value={`${stats?.combinedHours} ч`}
                  sub={stats?.combinedOT && stats.combinedOT > 0 ? `+ ${stats.combinedOT} ч сверхурочных` : "все ставки"}
                  accent="text-blue-600"
                  icon={Clock}
                />
              )}
            </div>

            {!tsLoading && monthlyTotalRecords === 0 && (
              <p className="text-sm text-muted-foreground mt-3 text-center py-4">
                Нет отметок за {MONTHS[tsMonth]} {tsYear}
              </p>
            )}
          </section>

          {/* Зарплата за выбранный месяц */}
          {salaryLoading ? (
            <>
              <Separator />
              <section>
                <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4 animate-pulse" />
                  Загрузка расчёта зарплаты...
                </div>
              </section>
            </>
          ) : salary?.hasSalary ? (
            <>
              <Separator />
              <section>
                <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Зарплата — {salary.positionName} ({MONTHS[salary.month ?? now.getMonth()]} {salary.year ?? now.getFullYear()})
                </h2>
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Оклад</p>
                      <p className="font-semibold">{formatRub(salary.baseSalary)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Норма часов</p>
                      <p className="font-semibold">{salary.normHours} ч ({salary.normWorkdays} дн.)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Отработано</p>
                      <p className="font-semibold">{salary.workedHours.toFixed(1)} ч</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Почасовая ставка</p>
                      <p className="font-semibold">{formatRub(salary.hourlyRate)}/ч</p>
                    </div>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Основная часть</p>
                      <p className="font-semibold">{formatRub(salary.regularPay)}</p>
                    </div>
                    {salary.otHours > 0 && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">
                          СВ ({salary.otHours} ч, ×{salary.otCoef1 ?? 1.5}/{salary.otCoef2 ?? 2.0} порог {salary.otThreshold ?? 2} ч)
                        </p>
                        <p className="font-semibold text-orange-600">{formatRub(salary.otPay)}</p>
                      </div>
                    )}
                    {(salary.weekendHours ?? 0) > 0 && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">
                          Выходные ({(salary.weekendHours ?? 0).toFixed(1)} ч, ×{salary.weekendCoef ?? 2.0})
                        </p>
                        <p className="font-semibold text-blue-600">{formatRub(salary.weekendPay ?? 0)}</p>
                      </div>
                    )}
                    {(salary.holidayHours ?? 0) > 0 && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">
                          Праздники ({(salary.holidayHours ?? 0).toFixed(1)} ч, ×{salary.holidayCoef ?? 2.0})
                        </p>
                        <p className="font-semibold text-purple-600">{formatRub(salary.holidayPay ?? 0)}</p>
                      </div>
                    )}
                    {(salary.sickDays ?? 0) > 0 && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">
                          Больничный ({salary.sickDays} дн., стаж {salary.experienceYears} л., {Math.round((salary.sickPayRate ?? 0) * 100)}%)
                        </p>
                        <p className="font-semibold text-amber-600">{formatRub(salary.sickPay ?? 0)}</p>
                      </div>
                    )}
                    {(salary.vacationDays ?? 0) > 0 && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">
                          Отпускные ({salary.vacationDays} дн., {formatRub(salary.avgDailyRate ?? 0)}/дн.)
                        </p>
                        <p className="font-semibold text-blue-600">{formatRub(salary.vacationPay ?? 0)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Итого к выплате</p>
                      <p className="text-xl font-bold text-green-700">{formatRub(salary.totalPay)}</p>
                    </div>
                  </div>
                  {(salary.workedHours + (salary.weekendHours ?? 0) + (salary.holidayHours ?? 0) + ((salary.sickDays ?? 0) + (salary.vacationDays ?? 0)) * (salary.normHours / (salary.normWorkdays ?? 1))) < salary.normHours * 0.5 && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Данные могут быть неполными — отработано менее 50% нормы
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null}

          <Separator />

          {/* Табель сотрудника */}
          <section>
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Табель — {MONTHS[tsMonth]} {tsYear}
            </h2>

            {tsLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                Загрузка табеля...
              </div>
            ) : tsData ? (
              <TimesheetGrid
                rows={tsData.rows}
                markTypes={tsData.markTypes}
                holidays={tsData.holidays}
                daysInMonth={tsData.daysInMonth}
                year={tsYear}
                month={tsMonth}
                canEdit={canEdit()}
                onCellUpdate={handleCellUpdate}
              />
            ) : (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                Нет данных табеля
              </div>
            )}
          </section>

          <Separator />

          {/* За всё время */}
          <section>
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              За всё время
            </h2>

            {stats.allTime.totalRecords === 0 ? (
              <p className="text-sm text-muted-foreground">Нет данных по табелю</p>
            ) : (
              <div className="space-y-4">
                {/* Метрики */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Всего часов"
                    value={stats.allTime.totalHours}
                    icon={Clock}
                  />
                  <StatCard
                    label="Явок"
                    value={stats.allTime.byCode["Я"] ?? 0}
                    sub="дней"
                    accent="text-green-600"
                  />
                  <StatCard
                    label="Больничных"
                    value={stats.allTime.byCode["Б"] ?? 0}
                    sub="дней"
                    accent={(stats.allTime.byCode["Б"] ?? 0) > 0 ? "text-amber-600" : undefined}
                  />
                  <StatCard
                    label="Прогулов"
                    value={stats.allTime.byCode["П"] ?? 0}
                    sub="дней"
                    accent={(stats.allTime.byCode["П"] ?? 0) > 0 ? "text-destructive" : undefined}
                  />
                </div>

                {/* Дополнительная строка статистики */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard
                    label="Отпусков"
                    value={stats.allTime.byCode["ОТ"] ?? 0}
                    sub="дней"
                  />
                  <StatCard
                    label="Командировок"
                    value={stats.allTime.byCode["К"] ?? 0}
                    sub="дней"
                  />
                  <StatCard
                    label="Сокращённых дней"
                    value={stats.allTime.byCode["С"] ?? 0}
                    sub="дней"
                  />
                </div>

                {/* Предупреждение о прогулах */}
                {(stats.currentMonth.byCode["П"] ?? 0) >= 1 && (
                  <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>
                      <strong>{stats.currentMonth.byCode["П"]} {stats.currentMonth.byCode["П"] === 1 ? "прогул" : stats.currentMonth.byCode["П"] < 5 ? "прогула" : "прогулов"}</strong> в этом месяце — требует внимания руководителя
                    </span>
                  </div>
                )}

                {/* Дата в системе */}
                {stats.allTime.firstRecordDate && (
                  <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-muted-foreground">В системе с</span>
                    <span className="font-semibold">{formatDate(stats.allTime.firstRecordDate)}</span>
                    <span className="text-muted-foreground">
                      ({formatSinceDate(stats.allTime.firstRecordDate)})
                    </span>
                    {stats.allTime.lastRecordDate && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">последняя отметка</span>
                        <span className="font-semibold">{formatDate(stats.allTime.lastRecordDate)}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

        </div>
      ) : (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Не удалось загрузить статистику
        </div>
      )}

      {/* Диалог редактирования */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать сотрудника</DialogTitle>
          </DialogHeader>
          <EmployeeForm
            employee={employee}
            departments={departments}
            onSuccess={async () => {
              setShowEditDialog(false);
              // Перезагрузить данные сотрудника
              const res = await fetch(`/api/employees/${id}`);
              if (res.ok) setEmployee(await res.json());
            }}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
