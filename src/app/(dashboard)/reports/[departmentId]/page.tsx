"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { ReportCard } from "@/components/report-card";
import type { ReportData } from "@/types";

interface EmployeeReportRow {
  employeeId: string;
  fullName: string;
  personnelNumber: string;
  position: string;
  workDays: number;
  vacationDays: number;
  sickDays: number;
  absentDays: number;
  businessTripDays: number;
  totalHours: number;
  totalSalary: number | null;
}

const fmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export default function DepartmentReportPage() {
  const { departmentId } = useParams<{ departmentId: string }>();
  const searchParams = useSearchParams();

  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth()));

  const [report, setReport] = useState<ReportData | null>(null);
  const [rows, setRows] = useState<EmployeeReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!departmentId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/reports?year=${year}&month=${month}&departmentId=${departmentId}`).then((r) => r.json()),
      fetch(`/api/reports/employees?year=${year}&month=${month}&departmentId=${departmentId}`).then((r) => r.json()),
    ])
      .then(([reportData, empData]) => {
        const reports: ReportData[] = reportData.reports ?? [];
        setReport(reports[0] ?? null);
        setRows(empData.rows ?? []);
      })
      .catch(() => setError("Ошибка загрузки данных"))
      .finally(() => setLoading(false));
  }, [departmentId, year, month]);

  const backHref = `/reports`;

  return (
    <div className="space-y-6">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Отчёты
        </Link>
        {report && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">{report.departmentName}</span>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Загрузка...
        </div>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : !report ? (
        <p className="text-muted-foreground text-sm">Нет данных за выбранный период</p>
      ) : (
        <>
          {/* Сводная карточка */}
          <div className="max-w-sm">
            <ReportCard data={report} />
          </div>

          {/* Таблица сотрудников */}
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Сотрудники ({rows.length})
            </h2>
            {rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">Нет данных</p>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b">
                      <th className="text-left px-4 py-2.5 font-medium">ФИО</th>
                      <th className="text-left px-4 py-2.5 font-medium">Таб.№</th>
                      <th className="text-left px-4 py-2.5 font-medium">Должность</th>
                      <th className="text-right px-4 py-2.5 font-medium">Явки</th>
                      <th className="text-right px-4 py-2.5 font-medium">Часы</th>
                      <th className="text-right px-4 py-2.5 font-medium">Отпуск</th>
                      <th className="text-right px-4 py-2.5 font-medium">Больн.</th>
                      <th className="text-right px-4 py-2.5 font-medium">Прогулы</th>
                      <th className="text-right px-4 py-2.5 font-medium">Зарплата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.employeeId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{row.fullName}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.personnelNumber}</td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate" title={row.position}>
                          {row.position}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{row.workDays}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{row.totalHours}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.vacationDays > 0 ? (
                            <span className="text-indigo-600">{row.vacationDays}</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.sickDays > 0 ? (
                            <span className="text-red-600">{row.sickDays}</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.absentDays > 0 ? (
                            <span className="text-amber-600 font-semibold">{row.absentDays}</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                          {row.totalSalary != null
                            ? `${fmt.format(row.totalSalary)} ₽`
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
