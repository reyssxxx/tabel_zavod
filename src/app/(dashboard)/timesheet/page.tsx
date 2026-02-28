"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { TimesheetFilters } from "@/components/timesheet-filters";
import { TimesheetGrid } from "@/components/timesheet-grid";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTHS } from "@/lib/constants";
import type { TimesheetRow, MarkTypeOption, DepartmentOption, SessionUser } from "@/types";

interface TimesheetData {
  rows: TimesheetRow[];
  markTypes: MarkTypeOption[];
  holidays: Record<string, { name: string; isShortened: boolean }>;
  daysInMonth: number;
}

export default function TimesheetPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const userRole = user?.role ?? "ACCOUNTANT";
  const userDepartmentId = user?.departmentId ?? null;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [departmentId, setDepartmentId] = useState<string>("all");

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [data, setData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [bulkMarkTypeId, setBulkMarkTypeId] = useState<string>("");
  const [bulkApplying, setBulkApplying] = useState(false);

  // Загружаем список подразделений (ждём пока сессия загрузится)
  useEffect(() => {
    if (!userRole) return;
    fetch("/api/departments")
      .then((r) => r.json())
      .then((deps) => {
        if (Array.isArray(deps)) setDepartments(deps);
      })
      .catch(console.error);
  }, [userRole]);

  // MANAGER: автоматически ставим свой departmentId
  useEffect(() => {
    if (userRole === "MANAGER" && userDepartmentId) {
      setDepartmentId(userDepartmentId);
    }
  }, [userRole, userDepartmentId]);

  // Загружаем данные табеля
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      if (departmentId && departmentId !== "all") {
        params.set("departmentId", departmentId);
      }
      const res = await fetch(`/api/timerecords?${params}`);
      if (!res.ok) throw new Error("Ошибка загрузки данных");
      const json: TimesheetData = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [year, month, departmentId]);

  useEffect(() => {
    if (!userRole) return;
    fetchData();
  }, [fetchData, userRole]);

  const handleCellUpdate = useCallback(
    async (employeeId: string, day: number, markTypeId: string | null) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const newRows = prev.rows.map((row) => {
          if (row.employee.id !== employeeId) return row;

          const oldRecord = row.records[day] ?? null;
          const newRecords = { ...row.records };

          if (markTypeId === null) {
            delete newRecords[day];
            const oldMarkType = oldRecord
              ? prev.markTypes.find((m) => m.id === oldRecord.markTypeId)
              : null;
            return {
              ...row,
              records: newRecords,
              totalDays: row.totalDays - (oldRecord ? 1 : 0),
              totalHours: row.totalHours - (oldMarkType?.defaultHours ?? 0),
            };
          } else {
            const markType = prev.markTypes.find((m) => m.id === markTypeId);
            if (!markType) return row;
            const oldMarkType = oldRecord
              ? prev.markTypes.find((m) => m.id === oldRecord.markTypeId)
              : null;
            newRecords[day] = {
              employeeId,
              date: dateStr,
              markTypeId,
              markCode: markType.code,
              markColor: markType.color,
            };
            return {
              ...row,
              records: newRecords,
              totalDays: row.totalDays + (oldRecord ? 0 : 1),
              totalHours:
                row.totalHours - (oldMarkType?.defaultHours ?? 0) + markType.defaultHours,
            };
          }
        });
        return { ...prev, rows: newRows };
      });

      // Отправляем запрос на сервер
      try {
        const res = await fetch("/api/timerecords", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            date: `${dateStr}T00:00:00.000Z`,
            markTypeId,
          }),
        });
        if (!res.ok) {
          fetchData();
        }
      } catch {
        fetchData();
      }
    },
    [year, month, fetchData]
  );

  // Bulk selection handlers
  const handleCellSelect = useCallback((employeeId: string, day: number) => {
    const key = `${employeeId}:${day}`;
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleExitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedCells(new Set());
    setBulkMarkTypeId("");
  }, []);

  const handleBulkApply = useCallback(async () => {
    if (!bulkMarkTypeId || selectedCells.size === 0 || !data) return;
    setBulkApplying(true);
    try {
      const records = Array.from(selectedCells).map((key) => {
        const [employeeId, dayStr] = key.split(":");
        const day = parseInt(dayStr);
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return { employeeId, date: `${dateStr}T00:00:00.000Z`, markTypeId: bulkMarkTypeId };
      });

      const res = await fetch("/api/timerecords/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: records }),
      });

      if (!res.ok) {
        const errData = await res.json();
        toast.error(errData.error ?? "Ошибка массового заполнения");
        return;
      }

      const { updated } = await res.json();
      toast.success(`Обновлено записей: ${updated}`);
      handleExitSelectionMode();
      fetchData();
    } catch {
      toast.error("Ошибка массового заполнения");
    } finally {
      setBulkApplying(false);
    }
  }, [bulkMarkTypeId, selectedCells, data, year, month, fetchData, handleExitSelectionMode]);

  const canEditRows = userRole === "ADMIN" || userRole === "MANAGER";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Табель учёта рабочего времени</h1>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-sm text-muted-foreground">
              {MONTHS[month]} {year} — {data.rows.length}{" "}
              {data.rows.length === 1
                ? "сотрудник"
                : data.rows.length < 5
                ? "сотрудника"
                : "сотрудников"}
            </span>
          )}
          {canEditRows && !loading && data && (
            selectionMode ? (
              <Button variant="outline" size="sm" onClick={handleExitSelectionMode}>
                Отмена выбора
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                Выбрать ячейки
              </Button>
            )
          )}
        </div>
      </div>

      <TimesheetFilters
        year={year}
        month={month}
        departmentId={departmentId}
        departments={departments}
        userRole={userRole}
        onYearChange={setYear}
        onMonthChange={setMonth}
        onDepartmentChange={setDepartmentId}
      />

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Загрузка данных...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Легенда типов отметок */}
          <div className="flex flex-wrap gap-2">
            {data.markTypes.map((mt) => (
              <span
                key={mt.id}
                className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${mt.color}22`,
                  border: `1px solid ${mt.color}55`,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: mt.color,
                  }}
                />
                <span className="font-semibold">{mt.code}</span>
                <span className="text-muted-foreground">{mt.name}</span>
              </span>
            ))}
            {selectionMode && (
              <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium bg-blue-50 border border-blue-300 text-blue-700">
                Режим выбора: кликайте по ячейкам
              </span>
            )}
          </div>

          <TimesheetGrid
            rows={data.rows}
            markTypes={data.markTypes}
            holidays={data.holidays}
            daysInMonth={data.daysInMonth}
            year={year}
            month={month}
            canEdit={canEditRows}
            onCellUpdate={handleCellUpdate}
            selectionMode={selectionMode}
            selectedCells={selectedCells}
            onCellSelect={handleCellSelect}
          />

          {/* Bulk action bar */}
          {selectionMode && selectedCells.size > 0 && (
            <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-lg border border-blue-200 bg-white p-3 shadow-lg">
              <span className="text-sm font-medium text-blue-700">
                Выбрано ячеек: {selectedCells.size}
              </span>
              <div className="flex-1" />
              <Select value={bulkMarkTypeId} onValueChange={setBulkMarkTypeId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Выберите тип..." />
                </SelectTrigger>
                <SelectContent>
                  {data.markTypes.map((mt) => (
                    <SelectItem key={mt.id} value={mt.id}>
                      <span className="flex items-center gap-2">
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: mt.color,
                          }}
                        />
                        {mt.code} — {mt.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleBulkApply}
                disabled={!bulkMarkTypeId || bulkApplying}
              >
                {bulkApplying ? "Применение..." : "Применить"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedCells(new Set())}
              >
                Сбросить выбор
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
