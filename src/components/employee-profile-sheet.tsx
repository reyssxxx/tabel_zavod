"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, UserX, CalendarDays, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { MONTHS } from "@/lib/constants";
import type { EmployeeWithDepartment } from "@/types";

interface RecentRecord {
  date: string;
  markCode: string;
  markColor: string;
  markName: string;
  hours: number;
}

interface EmployeeStats {
  currentMonth: {
    year: number;
    month: number;
    byCode: Record<string, number>;
    totalHours: number;
    totalRecords: number;
  };
  allTime: {
    totalRecords: number;
    totalHours: number;
    byCode: Record<string, number>;
    firstRecordDate: string | null;
    lastRecordDate: string | null;
  };
  recentRecords: RecentRecord[];
}

interface EmployeeProfileSheetProps {
  employee: EmployeeWithDepartment | null;
  onClose: () => void;
  onEdit: (emp: EmployeeWithDepartment) => void;
  onDeactivate: (emp: EmployeeWithDepartment) => void;
  canEdit: boolean;
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
  Я: "bg-green-100 text-green-800",
  ОТ: "bg-blue-100 text-blue-800",
  Б: "bg-red-100 text-red-800",
  К: "bg-amber-100 text-amber-800",
  П: "bg-red-200 text-red-900",
  С: "bg-purple-100 text-purple-800",
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
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />}
      </div>
    </div>
  );
}

export function EmployeeProfileSheet({
  employee,
  onClose,
  onEdit,
  onDeactivate,
  canEdit,
}: EmployeeProfileSheetProps) {
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employee) {
      setStats(null);
      return;
    }
    setLoading(true);
    setStats(null);
    fetch(`/api/employees/${employee.id}/stats`)
      .then((r) => r.json())
      .then((data: EmployeeStats) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [employee?.id]);

  const isOpen = !!employee;

  const workingDays = stats
    ? getWorkingDaysInMonth(stats.currentMonth.year, stats.currentMonth.month)
    : 0;

  const filledPercent =
    workingDays > 0 && stats
      ? Math.round((stats.currentMonth.totalRecords / workingDays) * 100)
      : 0;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-0 p-0"
      >
        {employee && (
          <>
            {/* Шапка */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <SheetTitle className="text-lg leading-tight">{employee.fullName}</SheetTitle>
                  <SheetDescription className="text-sm">
                    {employee.position}
                  </SheetDescription>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">
                      {employee.department.name}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      Таб. № {employee.personnelNumber}
                    </span>
                    {employee.isActive ? (
                      <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs h-5">
                        Активен
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs h-5">
                        Неактивен
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {canEdit && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => { onEdit(employee); onClose(); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Редактировать
                  </Button>
                  {employee.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => { onDeactivate(employee); onClose(); }}
                    >
                      <UserX className="h-3.5 w-3.5" />
                      Деактивировать
                    </Button>
                  )}
                </div>
              )}
            </SheetHeader>

            <div className="flex-1 px-6 py-4 space-y-5">
              {loading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  Загрузка статистики...
                </div>
              )}

              {!loading && stats && (
                <>
                  {/* Текущий месяц */}
                  <section>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      {MONTHS[stats.currentMonth.month]} {stats.currentMonth.year}
                    </h3>

                    {/* Прогресс-бар заполненности */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Заполнено дней</span>
                        <span>
                          {stats.currentMonth.totalRecords} / {workingDays} ({filledPercent}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(filledPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <StatCard
                        label="Часов отработано"
                        value={stats.currentMonth.totalHours}
                        icon={Clock}
                      />
                      <StatCard
                        label="Явок"
                        value={stats.currentMonth.byCode["Я"] ?? 0}
                        sub="дней"
                        accent="text-green-600"
                      />
                    </div>

                    {/* Разбивка по кодам */}
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {(["ОТ", "Б", "К", "П", "С"] as const).map((code) => {
                        const count = stats.currentMonth.byCode[code] ?? 0;
                        if (count === 0) return null;
                        return (
                          <div
                            key={code}
                            className={`rounded-md px-2 py-1.5 text-center ${MARK_COLORS[code] ?? "bg-muted"}`}
                          >
                            <div className="text-sm font-bold">{count}</div>
                            <div className="text-xs">{MARK_LABELS[code] ?? code}</div>
                          </div>
                        );
                      })}
                      {/* Если никаких особых отметок нет */}
                      {(["ОТ", "Б", "К", "П", "С"] as const).every(
                        (c) => !stats.currentMonth.byCode[c]
                      ) && stats.currentMonth.totalRecords > 0 && (
                        <div className="col-span-3 text-xs text-muted-foreground text-center py-1">
                          Только явки в этом месяце
                        </div>
                      )}
                      {stats.currentMonth.totalRecords === 0 && (
                        <div className="col-span-3 text-xs text-muted-foreground text-center py-2">
                          Нет отметок в этом месяце
                        </div>
                      )}
                    </div>
                  </section>

                  <Separator />

                  {/* За всё время */}
                  <section>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" />
                      За всё время
                    </h3>

                    {stats.allTime.totalRecords === 0 ? (
                      <p className="text-sm text-muted-foreground">Нет данных по табелю</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <StatCard
                            label="Всего часов"
                            value={stats.allTime.totalHours}
                            icon={Clock}
                          />
                          <StatCard
                            label="Всего записей"
                            value={stats.allTime.totalRecords}
                            sub="отметок в табеле"
                          />
                        </div>

                        {/* Пропуски и больничные за всё время */}
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { code: "Я", label: "Явок" },
                            { code: "Б", label: "Больничных" },
                            { code: "П", label: "Прогулов" },
                          ].map(({ code, label }) => {
                            const count = stats.allTime.byCode[code] ?? 0;
                            return (
                              <div key={code} className="rounded-lg border p-2 text-center">
                                <div
                                  className={`text-lg font-bold ${
                                    code === "П" && count > 0
                                      ? "text-destructive"
                                      : code === "Б" && count > 0
                                      ? "text-amber-600"
                                      : "text-foreground"
                                  }`}
                                >
                                  {count}
                                </div>
                                <div className="text-xs text-muted-foreground">{label}</div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Предупреждение если много прогулов */}
                        {(stats.allTime.byCode["П"] ?? 0) >= 3 && (
                          <div className="mt-2 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {stats.allTime.byCode["П"]} прогулов за всё время
                          </div>
                        )}

                        {/* Первая запись = "в компании с..." */}
                        {stats.allTime.firstRecordDate && (
                          <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
                            <span className="text-muted-foreground">В системе с </span>
                            <span className="font-medium">
                              {formatDate(stats.allTime.firstRecordDate)}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              ({formatSinceDate(stats.allTime.firstRecordDate)})
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </section>

                  {/* Последние отметки */}
                  {stats.recentRecords.length > 0 && (
                    <>
                      <Separator />
                      <section>
                        <h3 className="text-sm font-semibold mb-3">
                          Последние отметки
                        </h3>
                        <div className="space-y-1">
                          {stats.recentRecords.map((rec, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between rounded-md px-3 py-1.5 hover:bg-muted/50 transition-colors"
                            >
                              <span className="text-sm text-muted-foreground tabular-nums">
                                {formatDate(rec.date)}
                              </span>
                              <div className="flex items-center gap-2">
                                {rec.hours > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {rec.hours} ч.
                                  </span>
                                )}
                                <span
                                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                                    MARK_COLORS[rec.markCode] ?? "bg-muted"
                                  }`}
                                >
                                  {rec.markCode}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </>
                  )}
                </>
              )}

              {!loading && !stats && (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  Не удалось загрузить статистику
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
