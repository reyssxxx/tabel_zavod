"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, BarChart3, CheckSquare, Plane, HeartPulse } from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  totalEmployees: number;
  totalDepartments: number;
  currentMonth: string;
  workDaysTotal: number;
  vacationDaysTotal: number;
  sickDaysTotal: number;
  absentDaysTotal: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const val = (n: number | undefined) =>
    stats === null ? "–" : String(n ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Табель учёта рабочего времени</h1>
        <p className="text-muted-foreground mt-1">
          АО «ТАНТК им. Г.М. Бериева» — система учёта рабочего времени сотрудников
        </p>
      </div>

      {/* Stat cards */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">
          {stats?.currentMonth ?? "Текущий месяц"}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Активных сотрудников</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{val(stats?.totalEmployees)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {val(stats?.totalDepartments)} подразделений
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Явок в этом месяце</CardTitle>
              <CheckSquare className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{val(stats?.workDaysTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">записей типа «Я»</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Отпусков</CardTitle>
              <Plane className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{val(stats?.vacationDaysTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">дней в отпуске</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Больничных</CardTitle>
              <HeartPulse className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{val(stats?.sickDaysTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {val(stats?.absentDaysTotal)} прогулов
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Nav cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/employees">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Users className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Сотрудники</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Справочник сотрудников предприятия
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/timesheet">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <CalendarDays className="h-5 w-5 text-green-500" />
              <CardTitle className="text-lg">Табель</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Учёт рабочего времени за месяц
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/reports">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <BarChart3 className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-lg">Отчёты</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Отчёты по подразделениям и экспорт
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
