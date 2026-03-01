"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { TimesheetFilters } from "@/components/timesheet-filters";
import { TimesheetGrid } from "@/components/timesheet-grid";
import { ExportButtons } from "@/components/export-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
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

  // Employee search
  const [employeeSearch, setEmployeeSearch] = useState("");

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
    async (employeeId: string, day: number, markTypeId: string | null, slot = 0, overtimeHours = 0, actualHours: number | null = null) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // Optimistic update (only for slot=0 primary)
      if (slot === 0) {
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
                totalOvertimeHours: row.totalOvertimeHours - (oldRecord?.overtimeHours ?? 0),
              };
            } else {
              const markType = prev.markTypes.find((m) => m.id === markTypeId);
              if (!markType) return row;
              const oldMarkType = oldRecord
                ? prev.markTypes.find((m) => m.id === oldRecord.markTypeId)
                : null;
              const schedHours = row.employee.schedule?.hoursPerDay ?? markType.defaultHours;
              const effectiveHours = actualHours ?? schedHours;
              newRecords[day] = {
                employeeId, date: dateStr, markTypeId,
                markCode: markType.code, markColor: markType.color,
                overtimeHours, actualHours, slot: 0,
              };
              const oldHours = oldRecord ? (oldRecord.actualHours ?? (row.employee.schedule?.hoursPerDay ?? (oldMarkType?.defaultHours ?? 0))) : 0;
              return {
                ...row,
                records: newRecords,
                totalDays: row.totalDays + (oldRecord ? 0 : 1),
                totalHours: row.totalHours - oldHours + effectiveHours,
                totalOvertimeHours: row.totalOvertimeHours - (oldRecord?.overtimeHours ?? 0) + overtimeHours,
              };
            }
          });
          return { ...prev, rows: newRows };
        });
      } else {
        // For slot=1 just refresh after server response
      }

      try {
        const res = await fetch("/api/timerecords", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            date: `${dateStr}T00:00:00.000Z`,
            markTypeId,
            slot,
            overtimeHours,
            actualHours,
          }),
        });
        if (!res.ok) {
          fetchData();
        } else if (slot === 1) {
          // Refresh to show secondary record properly
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
    const isClear = bulkMarkTypeId === "clear";
    try {
      const records = Array.from(selectedCells).map((key) => {
        const [employeeId, dayStr] = key.split(":");
        const day = parseInt(dayStr);
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return { employeeId, date: `${dateStr}T00:00:00.000Z`, markTypeId: isClear ? null : bulkMarkTypeId };
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
      toast.success(isClear ? `Очищено ячеек: ${updated}` : `Обновлено записей: ${updated}`);
      handleExitSelectionMode();
      fetchData();
    } catch {
      toast.error("Ошибка массового заполнения");
    } finally {
      setBulkApplying(false);
    }
  }, [bulkMarkTypeId, selectedCells, data, year, month, fetchData, handleExitSelectionMode]);

  const canEditRows = userRole === "ADMIN" || userRole === "MANAGER";

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return data.rows;
    return data.rows.filter(
      (row) =>
        row.employee.fullName.toLowerCase().includes(q) ||
        row.employee.personnelNumber.toLowerCase().includes(q)
    );
  }, [data, employeeSearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Табель учёта рабочего времени</h1>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-sm text-muted-foreground">
              {MONTHS[month]} {year} —{" "}
              {employeeSearch
                ? `${filteredRows.length} из ${data.rows.length}`
                : data.rows.length}{" "}
              {(employeeSearch ? filteredRows.length : data.rows.length) === 1
                ? "сотрудник"
                : (employeeSearch ? filteredRows.length : data.rows.length) < 5
                ? "сотрудника"
                : "сотрудников"}
            </span>
          )}
          {!loading && data && (
            <ExportButtons
              year={year}
              month={month}
              departmentId={departmentId}
              type="timesheet"
            />
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

      <div className="relative max-w-sm">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          width="15" height="15" viewBox="0 0 15 15" fill="none"
        >
          <path
            d="M10 6.5C10 8.43 8.43 10 6.5 10C4.57 10 3 8.43 3 6.5C3 4.57 4.57 3 6.5 3C8.43 3 10 4.57 10 6.5ZM9.36 10.07C8.62 10.66 7.6 11 6.5 11C4.01 11 2 8.99 2 6.5C2 4.01 4.01 2 6.5 2C8.99 2 11 4.01 11 6.5C11 7.6 10.66 8.62 10.07 9.36L12.85 12.15C13.05 12.34 13.05 12.66 12.85 12.85C12.66 13.05 12.34 13.05 12.15 12.85L9.36 10.07Z"
            fill="currentColor" fillRule="evenodd" clipRule="evenodd"
          />
        </svg>
        <Input
          className="pl-8"
          placeholder="Поиск по сотруднику или табельному №"
          value={employeeSearch}
          onChange={(e) => setEmployeeSearch(e.target.value)}
        />
        {employeeSearch && (
          <button
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setEmployeeSearch("")}
            type="button"
          >
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
              <path d="M11.78 4.22a.75.75 0 0 0-1.06-1.06L7.5 6.44 4.28 3.16a.75.75 0 0 0-1.06 1.06L6.44 7.5l-3.22 3.22a.75.75 0 1 0 1.06 1.06L7.5 8.56l3.22 3.22a.75.75 0 1 0 1.06-1.06L8.56 7.5l3.22-3.28Z" fill="currentColor"/>
            </svg>
          </button>
        )}
      </div>

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
          {/* Легенда типов отметок + кнопка выбора ячеек */}
          <div className="flex flex-wrap items-center gap-2">
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
            {canEditRows && (
              <div className="ml-auto">
                {selectionMode ? (
                  <Button variant="outline" size="sm" onClick={handleExitSelectionMode}>
                    Отмена выбора
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                    Выбрать ячейки
                  </Button>
                )}
              </div>
            )}
          </div>

          <TimesheetGrid
            rows={filteredRows}
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
                  <SelectValue placeholder="Выберите действие..." />
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
                  <SelectSeparator />
                  <SelectItem value="clear">
                    <span className="flex items-center gap-2 text-destructive">
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ef4444" }} />
                      Очистить ячейки
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleBulkApply}
                disabled={!bulkMarkTypeId || bulkApplying}
                variant={bulkMarkTypeId === "clear" ? "destructive" : "default"}
              >
                {bulkApplying ? "Применение..." : bulkMarkTypeId === "clear" ? "Очистить" : "Применить"}
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
