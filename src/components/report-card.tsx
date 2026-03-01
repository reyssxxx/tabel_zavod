import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle } from "lucide-react";
import { formatRub } from "@/lib/salary";
import type { ReportData } from "@/types";

interface ReportCardProps {
  data: ReportData;
}

function MetricRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm text-muted-foreground truncate">{label}</span>
      <span className="ml-auto font-semibold text-sm tabular-nums">{value}</span>
    </div>
  );
}

export function ReportCard({ data }: ReportCardProps) {
  const rateColor =
    data.attendanceRate >= 90
      ? "#22c55e"
      : data.attendanceRate >= 70
      ? "#f59e0b"
      : "#ef4444";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">
          {data.departmentName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hero: % явки + часы */}
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: rateColor }}
            />
            <span className="text-2xl font-bold tabular-nums">
              {data.attendanceRate}%
            </span>
            <span className="text-sm text-muted-foreground">явки</span>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold tabular-nums">
              {data.totalWorkHours} ч
            </div>
            <div className="text-xs text-muted-foreground">отработано</div>
          </div>
        </div>

        <Separator />

        {/* Детали */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <MetricRow
              label="Сотрудников"
              value={data.totalEmployees}
              color="#6b7280"
            />
            <MetricRow
              label="Раб.дней"
              value={data.workdaysInPeriod}
              color="#6b7280"
            />
            <MetricRow label="Явка" value={data.workDays} color="#22c55e" />
            <MetricRow label="Отпуск" value={data.vacationDays} color="#3b82f6" />
            <MetricRow
              label="Больничный"
              value={data.sickDays}
              color="#ef4444"
            />
            <MetricRow
              label="Командировки"
              value={data.businessTripDays}
              color="#f59e0b"
            />
            <MetricRow label="Прогулы" value={data.absentDays} color="#991b1b" />
            {data.shortenedDays > 0 && (
              <MetricRow
                label="Сокр. дни"
                value={data.shortenedDays}
                color="#a855f7"
              />
            )}
          </div>

          {/* Заполненность — всегда отображается */}
          {data.unmarkedDays > 0 ? (
            <div className="flex items-center gap-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 px-2.5 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500 shrink-0" />
              <span className="text-xs text-yellow-700 dark:text-yellow-400">
                Незаполнено: {data.unmarkedDays} дн.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/30 px-2.5 py-1.5">
              <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
              <span className="text-xs text-green-700 dark:text-green-400">
                Заполнено полностью
              </span>
            </div>
          )}
        </div>

        {/* ФОТ — только если есть сотрудники с должностями */}
        {data.salaryEmployeeCount > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Фонд оплаты труда</p>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-lg font-bold tabular-nums">{formatRub(data.totalSalary)}</div>
                  <div className="text-xs text-muted-foreground">Σ по {data.salaryEmployeeCount} сотр.</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">{formatRub(data.avgSalary)}</div>
                  <div className="text-xs text-muted-foreground">средняя</div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
