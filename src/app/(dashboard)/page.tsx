"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, Users, BarChart3, CheckSquare, Plane, HeartPulse,
  TrendingUp, TrendingDown, AlertTriangle, UserCheck, Clock,
  ChevronLeft, ChevronRight, X, ClipboardCheck,
} from "lucide-react";
import Link from "next/link";

interface DeptSpotlight {
  id: string;
  name: string;
  rate: number;
  employeeCount: number;
}

interface DailyPoint {
  day: number;
  sick: number;
  absent: number;
}

interface Anomaly {
  type: string;
  count: number;
  label: string;
}

interface DashboardStats {
  totalEmployees: number;
  totalDepartments: number;
  currentMonth: string;
  workDaysTotal: number;
  vacationDaysTotal: number;
  sickDaysTotal: number;
  absentDaysTotal: number;
  businessTripDaysTotal: number;
  todayPresent: number;
  todayVacation: number;
  todaySick: number;
  todayAbsent: number;
  todayUnmarked: number;
  worstDept: DeptSpotlight | null;
  bestDept: DeptSpotlight | null;
  dailyChart: DailyPoint[];
  fillRate: number;
  anomalies: Anomaly[];
  isToday: boolean;
  selectedDate: string;
}

const ANOMALY_CONFIG: Record<string, { icon: React.ElementType; bg: string; border: string; text: string }> = {
  many_absences: { icon: AlertTriangle, bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-800" },
  long_sick:     { icon: HeartPulse,   bg: "bg-red-50",    border: "border-red-200",   text: "text-red-800"   },
  no_records:    { icon: Clock,        bg: "bg-slate-50",  border: "border-slate-200", text: "text-slate-700"  },
};

function AnomalyBanner({ anomaly, onDismiss }: { anomaly: Anomaly; onDismiss: () => void }) {
  const cfg = ANOMALY_CONFIG[anomaly.type] ?? ANOMALY_CONFIG.no_records;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        <span className="font-semibold">{anomaly.count}</span> {anomaly.label}
      </span>
      <Link href="/timesheet" className="underline underline-offset-2 text-xs font-medium hover:opacity-80">
        Открыть табель →
      </Link>
      <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 90 ? "#22c55e" : rate >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color }} className="font-semibold">{rate}%</span>
        <span className="text-muted-foreground">явки</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, rate)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function SparklineChart({ data, highlightDay }: { data: DailyPoint[]; highlightDay: number }) {
  if (!data || data.length === 0) return null;

  const W = 560;
  const H = 100;
  const PAD = { top: 8, right: 8, bottom: 20, left: 28 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.sick, d.absent)));
  const n = data.length;
  const step = chartW / Math.max(1, n - 1);

  const toX = (i: number) => PAD.left + i * step;
  const toY = (v: number) => PAD.top + chartH - (v / maxVal) * chartH;

  const polyline = (getter: (d: DailyPoint) => number) =>
    data.map((d, i) => `${toX(i).toFixed(1)},${toY(getter(d)).toFixed(1)}`).join(" ");

  const area = (getter: (d: DailyPoint) => number, color: string) => {
    const pts = data.map((d, i) => `${toX(i).toFixed(1)},${toY(getter(d)).toFixed(1)}`).join(" ");
    const base = `${toX(n - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} ${toX(0).toFixed(1)},${(PAD.top + chartH).toFixed(1)}`;
    return <polygon points={`${pts} ${base}`} fill={color} fillOpacity={0.12} />;
  };

  const ticks = maxVal <= 4
    ? Array.from({ length: maxVal + 1 }, (_, i) => i)
    : [0, Math.round(maxVal / 2), maxVal];

  // Highlight line for selected day
  const hlIdx = data.findIndex((d) => d.day === highlightDay);
  const hlX = hlIdx >= 0 ? toX(hlIdx) : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: H }}
      aria-label="График больничных и прогулов по дням"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left} x2={W - PAD.right}
            y1={toY(t)} y2={toY(t)}
            stroke="#e5e7eb" strokeWidth={1}
          />
          <text x={PAD.left - 4} y={toY(t) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{t}</text>
        </g>
      ))}

      {/* Vertical line for selected day */}
      {hlX !== null && (
        <line
          x1={hlX} x2={hlX}
          y1={PAD.top} y2={PAD.top + chartH}
          stroke="#6366f1" strokeWidth={1.5} strokeDasharray="3 2"
        />
      )}

      {area((d) => d.sick, "#ef4444")}
      {area((d) => d.absent, "#f59e0b")}

      <polyline
        points={polyline((d) => d.sick)}
        fill="none" stroke="#ef4444" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"
      />
      <polyline
        points={polyline((d) => d.absent)}
        fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"
      />

      {data.map((d, i) => {
        if (n > 15 && d.day % 5 !== 0 && d.day !== 1) return null;
        return (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize={9} fill={d.day === highlightDay ? "#6366f1" : "#9ca3af"}>
            {d.day}
          </text>
        );
      })}

      {data.map((d, i) => (
        <g key={i}>
          {d.sick > 0 && (
            <circle cx={toX(i)} cy={toY(d.sick)} r={2.5} fill="#ef4444" />
          )}
          {d.absent > 0 && (
            <circle cx={toX(i)} cy={toY(d.absent)} r={2.5} fill="#f59e0b" />
          )}
        </g>
      ))}
    </svg>
  );
}

const DAY_NAMES_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS_RU = [
  "января","февраля","марта","апреля","мая","июня",
  "июля","августа","сентября","октября","ноября","декабря",
];

export default function DashboardPage() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());

  const fetchStats = useCallback((date: Date) => {
    setLoading(true);
    const iso = formatLocalDate(date);
    fetch(`/api/dashboard?date=${iso}`)
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStats(selectedDate);
  }, [selectedDate, fetchStats]);

  const goDay = (delta: number) => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      // Не уходим в будущее
      if (d > today) return prev;
      return d;
    });
  };

  const isToday = formatLocalDate(selectedDate) === formatLocalDate(today);

  const val = (n: number | undefined) => (loading || stats === null ? "–" : String(n ?? 0));

  const dayName = DAY_NAMES_SHORT[selectedDate.getDay()];
  const dateLabel = `${dayName}, ${selectedDate.getDate()} ${MONTHS_RU[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  const selDay = selectedDate.getDate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Табель учёта рабочего времени</h1>
        <p className="text-muted-foreground mt-1">
          АО «ТАНТК им. Г.М. Бериева» — система учёта рабочего времени сотрудников
        </p>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => goDay(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-medium capitalize ${loading ? "text-muted-foreground" : ""}`}>
            {isToday ? `Сегодня — ${dateLabel}` : dateLabel}
          </span>
          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-6 px-2"
              onClick={() => setSelectedDate(today)}
            >
              Вернуться к сегодня
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => goDay(1)}
          disabled={isToday}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <input
          type="date"
          max={formatLocalDate(today)}
          value={formatLocalDate(selectedDate)}
          onChange={(e) => {
            if (!e.target.value) return;
            const d = new Date(e.target.value + "T00:00:00");
            if (d <= today) setSelectedDate(d);
          }}
          className="ml-1 h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Anomaly banners */}
      {stats && stats.anomalies && stats.anomalies.length > 0 && (
        <div className="flex flex-col gap-2">
          {stats.anomalies
            .filter((a) => !dismissedAnomalies.has(a.type))
            .map((a) => (
              <AnomalyBanner
                key={a.type}
                anomaly={a}
                onDismiss={() => setDismissedAnomalies((prev) => new Set([...prev, a.type]))}
              />
            ))}
        </div>
      )}

      {/* Day stats */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">
          {isToday ? "На месте сегодня" : `Отметки за ${selectedDate.getDate()} ${MONTHS_RU[selectedDate.getMonth()]}`}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {isToday ? "На месте сегодня" : "Явка"}
              </CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{val(stats?.todayPresent)}</div>
              <p className="text-xs text-muted-foreground mt-1">сотрудников (Я)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">В отпуске</CardTitle>
              <Plane className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{val(stats?.todayVacation)}</div>
              <p className="text-xs text-muted-foreground mt-1">сотрудников (ОТ)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">На больничном</CardTitle>
              <HeartPulse className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{val(stats?.todaySick)}</div>
              <p className="text-xs text-muted-foreground mt-1">сотрудников (Б)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Прогулы</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{val(stats?.todayAbsent)}</div>
              <p className="text-xs text-muted-foreground mt-1">сотрудников (П)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Не заполнено</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-muted-foreground">{val(stats?.todayUnmarked)}</div>
              <p className="text-xs text-muted-foreground mt-1">без отметки</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Month totals */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">
          {stats?.currentMonth ?? "Текущий месяц"} — итоги
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Заполненность табеля</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-violet-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${
                (stats?.fillRate ?? 0) >= 90 ? "text-green-600" :
                (stats?.fillRate ?? 0) >= 70 ? "text-amber-600" : "text-red-600"
              }`}>
                {stats ? `${stats.fillRate}%` : "—"}
              </div>
              <RateBar rate={stats?.fillRate ?? 0} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Daily chart + dept spotlights */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Больничные и прогулы по дням — {stats?.currentMonth ?? "текущий месяц"}
            </CardTitle>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 bg-red-500 rounded" />
                Больничные (Б)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 bg-amber-500 rounded" />
                Прогулы (П)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 rounded" style={{ background: "#6366f1", borderTop: "1px dashed #6366f1" }} />
                Выбранный день
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {stats ? (
              <SparklineChart data={stats.dailyChart} highlightDay={selDay} />
            ) : (
              <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
                Загрузка...
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {stats?.worstDept && (
            <Card className="border-orange-200 flex-1">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Требует внимания</CardTitle>
                <TrendingDown className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="font-semibold text-base truncate">{stats.worstDept.name}</div>
                <p className="text-xs text-muted-foreground">{stats.worstDept.employeeCount} чел.</p>
                <RateBar rate={stats.worstDept.rate} />
              </CardContent>
            </Card>
          )}

          {stats?.bestDept && (
            <Card className="border-green-200 flex-1">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Лучший результат</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="font-semibold text-base truncate">{stats.bestDept.name}</div>
                <p className="text-xs text-muted-foreground">{stats.bestDept.employeeCount} чел.</p>
                <RateBar rate={stats.bestDept.rate} />
              </CardContent>
            </Card>
          )}

          {!stats && (
            <Card className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
              Загрузка...
            </Card>
          )}
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
