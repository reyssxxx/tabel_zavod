"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ReportFilters } from "@/components/report-filters";
import { ReportCard } from "@/components/report-card";
import { ExportButtons } from "@/components/export-buttons";
import type { ReportData, DepartmentOption, SessionUser } from "@/types";

const now = new Date();

export default function ReportsPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [departmentId, setDepartmentId] = useState("all");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;

  // Загружаем список подразделений при монтировании
  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => {
        setDepartments(Array.isArray(data) ? data : []);
      })
      .catch(() => setDepartments([]));
  }, []);

  // Для MANAGER фиксируем подразделение
  useEffect(() => {
    if (user?.role === "MANAGER" && user.departmentId) {
      setDepartmentId(user.departmentId);
    }
  }, [user]);

  // Загружаем данные при изменении фильтров
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/reports?year=${year}&month=${month}&departmentId=${departmentId}`)
      .then((r) => r.json())
      .then((data) => {
        setReports(data.reports ?? []);
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [year, month, departmentId, user]);

  function handleFiltersChange(value: {
    year: number;
    month: number;
    departmentId: string;
  }) {
    setYear(value.year);
    setMonth(value.month);
    setDepartmentId(value.departmentId);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Отчёты</h1>

      {/* Фильтры и кнопки экспорта */}
      <div className="flex flex-wrap items-center gap-3">
        <ReportFilters
          year={year}
          month={month}
          departmentId={departmentId}
          departments={departments}
          userRole={user?.role ?? "ACCOUNTANT"}
          onChange={handleFiltersChange}
        />
        <div className="ml-auto flex gap-2">
          <ExportButtons
            year={year}
            month={month}
            departmentId={departmentId}
            type="report"
          />
        </div>
      </div>

      {/* Карточки отчётов */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Загрузка...</p>
      ) : reports.length === 0 ? (
        <p className="text-muted-foreground text-sm">Нет данных за выбранный период</p>
      ) : (
        <div
          className={
            departmentId === "all"
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
              : "max-w-sm"
          }
        >
          {reports.map((report) => (
            <ReportCard key={report.departmentId} data={report} />
          ))}
        </div>
      )}
    </div>
  );
}
