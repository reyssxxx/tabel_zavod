"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AuditLogRow, AuditUserOption, SessionUser } from "@/types";
import { ROLE_LABELS } from "@/lib/constants";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  TIMERECORD: "Запись табеля",
  EMPLOYEE: "Сотрудник",
  EMPLOYEE_IMPORT: "Импорт CSV",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Создание",
  UPDATE: "Изменение",
  DELETE: "Удаление",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const ACTION_BADGE: Record<string, BadgeVariant> = {
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  // Обрезаем до "YYYY-MM-DD" на случай если пришёл полный ISO (2026-02-15T00:00:00.000Z)
  const datePart = dateStr.substring(0, 10);
  const parts = datePart.split("-");
  if (parts.length !== 3) return datePart;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function buildDescription(row: AuditLogRow): string {
  const d = row.details;

  if (row.entityType === "TIMERECORD") {
    if (row.entityId === "BULK") {
      const count = d.count as number;
      const codes = (d.markCodes as string[])?.join(", ") ?? "—";
      const range = d.dateRange as { from: string; to: string } | undefined;
      const from = range?.from ? formatDate(range.from) : "—";
      const to = range?.to ? formatDate(range.to) : "—";
      return `Массовое заполнение: ${count} яч., код «${codes}», ${from}–${to}`;
    }
    const name = String(d.employeeName ?? "—");
    const num = String(d.personnelNumber ?? "—");
    const date = formatDate(String(d.date ?? ""));
    const base = `${name} (${num}), ${date}`;
    if (row.action === "CREATE") return `${base} — отметка «${String(d.markCode ?? "—")}»`;
    if (row.action === "DELETE") return `${base} — отметка удалена`;
    if (row.action === "UPDATE") {
      const before = d.before as Record<string, unknown> | undefined;
      return `${base} — «${String(before?.markCode ?? "—")}» → «${String(d.markCode ?? "—")}»`;
    }
  }

  if (row.entityType === "EMPLOYEE") {
    const name = String(d.fullName ?? "—");
    const num = String(d.personnelNumber ?? "—");
    if (row.action === "CREATE") {
      return `Добавлен: ${name} (${num}), ${String(d.departmentName ?? "—")}`;
    }
    if (row.action === "DELETE") {
      return `Деактивирован: ${name} (${num}), ${String(d.departmentName ?? "—")}`;
    }
    if (row.action === "UPDATE") {
      const changed = d.changedFields as Record<string, { before: unknown; after: unknown }> | undefined;
      if (!changed || Object.keys(changed).length === 0) return `${name} — без изменений`;
      const fieldLabels: Record<string, string> = {
        fullName: "ФИО",
        position: "Должность",
        personnelNumber: "Таб. номер",
        departmentName: "Подразделение",
        isActive: "Активен",
        scheduleId: "График",
      };
      const parts = Object.entries(changed).map(([field, v]) => {
        const label = fieldLabels[field] ?? field;
        const before = v.before == null ? "—" : String(v.before);
        const after = v.after == null ? "—" : String(v.after);
        return `${label}: «${before}» → «${after}»`;
      });
      return `${name} — ${parts.join("; ")}`;
    }
  }

  if (row.entityType === "EMPLOYEE_IMPORT") {
    const imported = Number(d.imported ?? 0);
    const total = Number(d.totalRows ?? 0);
    const skipped = Number(d.skipped ?? 0);
    const fileName = String(d.fileName ?? "");
    return (
      `${fileName ? `«${fileName}»: ` : ""}Импортировано ${imported} из ${total} строк` +
      (skipped > 0 ? `, пропущено: ${skipped}` : "")
    );
  }

  return JSON.stringify(d);
}

interface Filters {
  entityType: string;
  action: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
  page: number;
}

export default function AuditPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;

  const [filters, setFilters] = useState<Filters>({
    entityType: "",
    action: "",
    userId: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
  });
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [users, setUsers] = useState<AuditUserOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(filters.page) });
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.action) params.set("action", filters.action);
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    try {
      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows);
        setTotal(data.total);
        setPageSize(data.pageSize);
        setUsers(data.users);
      }
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (user) fetchLogs();
  }, [fetchLogs, user]);

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (user && user.role !== "ADMIN" && user.role !== "ACCOUNTANT") {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Доступ только для администраторов и бухгалтеров
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Журнал аудита</h1>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2 items-end">
        <Select value={filters.entityType || "all"} onValueChange={(v) => setFilter("entityType", v === "all" ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Тип записи" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="TIMERECORD">Запись табеля</SelectItem>
            <SelectItem value="EMPLOYEE">Сотрудник</SelectItem>
            <SelectItem value="EMPLOYEE_IMPORT">Импорт CSV</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.action || "all"} onValueChange={(v) => setFilter("action", v === "all" ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Действие" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все действия</SelectItem>
            <SelectItem value="CREATE">Создание</SelectItem>
            <SelectItem value="UPDATE">Изменение</SelectItem>
            <SelectItem value="DELETE">Удаление</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.userId || "all"} onValueChange={(v) => setFilter("userId", v === "all" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Пользователь" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все пользователи</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.userId} value={u.userId}>{u.userName}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">с</span>
          <input
            type="date"
            className="border rounded px-2 py-1.5 text-sm"
            value={filters.dateFrom}
            onChange={(e) => setFilter("dateFrom", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">по</span>
          <input
            type="date"
            className="border rounded px-2 py-1.5 text-sm"
            value={filters.dateTo}
            onChange={(e) => setFilter("dateTo", e.target.value)}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilters({ entityType: "", action: "", userId: "", dateFrom: "", dateTo: "", page: 1 })}
        >
          Сбросить
        </Button>
      </div>

      {/* Таблица */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Дата/время</TableHead>
              <TableHead className="w-44">Пользователь</TableHead>
              <TableHead className="w-32">Действие</TableHead>
              <TableHead className="w-36">Тип</TableHead>
              <TableHead>Описание</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Записей не найдено
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{row.userName}</span>
                      <Badge variant="outline" className="text-xs w-fit">
                        {ROLE_LABELS[row.userRole] ?? row.userRole}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ACTION_BADGE[row.action] ?? "outline"}>
                      {ACTION_LABELS[row.action] ?? row.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ENTITY_TYPE_LABELS[row.entityType] ?? row.entityType}
                  </TableCell>
                  <TableCell className="text-sm max-w-md">
                    {buildDescription(row)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Пагинация */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Всего записей: {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1 || loading}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            <ChevronLeft className="h-4 w-4" />
            Назад
          </Button>
          <span className="text-sm">
            Страница {filters.page} из {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= totalPages || loading}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Вперёд
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
