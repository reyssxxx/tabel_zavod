"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { TimesheetCell } from "@/components/timesheet-cell";
import { CellPopup } from "@/components/cell-popup";
import { isWeekend, formatDateKey } from "@/lib/holidays";
import type { TimesheetRow, MarkTypeOption } from "@/types";
import type { CellClickInfo } from "@/components/timesheet-cell";

interface TimesheetGridProps {
  rows: TimesheetRow[];
  markTypes: MarkTypeOption[];
  holidays: Record<string, { name: string; isShortened: boolean }>;
  daysInMonth: number;
  year: number;
  month: number;
  canEdit: boolean;
  onCellUpdate: (employeeId: string, day: number, markTypeId: string | null, slot?: number, overtimeHours?: number, actualHours?: number | null) => void;
  selectionMode?: boolean;
  selectedCells?: Set<string>;
  onCellSelect?: (employeeId: string, day: number) => void;
}

const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function TimesheetGrid({
  rows,
  markTypes,
  holidays,
  daysInMonth,
  year,
  month,
  canEdit,
  onCellUpdate,
  selectionMode = false,
  selectedCells = new Set(),
  onCellSelect,
}: TimesheetGridProps) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const [openCell, setOpenCell] = useState<CellClickInfo | null>(null);
  const isDragging = useRef(false);

  // Снимаем флаг drag при отпускании ЛКМ где угодно на странице
  useEffect(() => {
    const handleMouseUp = () => { isDragging.current = false; };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const handleCellOpen = useCallback((info: CellClickInfo) => {
    setOpenCell((prev) =>
      prev && prev.employeeId === info.employeeId && prev.day === info.day ? null : info
    );
  }, []);

  const handlePopupApply = useCallback((employeeId: string, day: number, markTypeId: string | null, slot: number, overtimeHours: number, actualHours: number | null) => {
    onCellUpdate(employeeId, day, markTypeId, slot, overtimeHours, actualHours);
  }, [onCellUpdate]);

  const handlePopupClose = useCallback(() => setOpenCell(null), []);
  const totalDays = rows.reduce((sum, r) => sum + r.totalDays, 0);
  const totalHours = rows.reduce((sum, r) => sum + r.totalHours, 0);
  const totalOT = rows.reduce((sum, r) => sum + r.totalOvertimeHours, 0);

  const getHeaderStyle = (day: number) => {
    const date = new Date(year, month, day);
    const key = formatDateKey(year, month, day);
    const holiday = holidays[key];
    const weekend = isWeekend(date);
    if (holiday && !holiday.isShortened) return { backgroundColor: "#fff7ed", color: "#ea580c" };
    if (holiday && holiday.isShortened) return { backgroundColor: "#fefce8" };
    if (weekend) return { backgroundColor: "#f3f4f6", color: "#9ca3af" };
    return {};
  };

  const thBase: React.CSSProperties = {
    minWidth: 36, width: 36, textAlign: "center", padding: "4px 0", fontSize: 11, fontWeight: 600,
    border: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 5, backgroundColor: "#f9fafb",
  };
  const stickyNameTh: React.CSSProperties = {
    position: "sticky", left: 0, zIndex: 15, backgroundColor: "#f9fafb",
    textAlign: "left", padding: "6px 12px", fontSize: 12, fontWeight: 600,
    border: "1px solid #e5e7eb", minWidth: 200, whiteSpace: "nowrap",
  };
  const stickyNameTd: React.CSSProperties = {
    position: "sticky", left: 0, zIndex: 10, backgroundColor: "white",
    padding: "4px 12px", fontSize: 12, border: "1px solid #e5e7eb", minWidth: 200, whiteSpace: "nowrap",
  };
  const totalTh: React.CSSProperties = { ...thBase, minWidth: 44, width: 44 };

  // Keep popup's value/secondaryValue fresh after onCellUpdate re-renders rows
  const freshOpenCell: CellClickInfo | null = openCell ? (() => {
    const row = rows.find((r) => r.employee.id === openCell.employeeId);
    if (!row) return openCell;
    return { ...openCell, value: row.records[openCell.day] ?? null, secondaryValue: row.secondaryRecords[openCell.day] ?? null };
  })() : null;

  return (
    <>
    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}>
      <table style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={stickyNameTh}>Сотрудник</th>
            {days.map((day) => {
              const date = new Date(year, month, day);
              const dayName = DAY_NAMES[date.getDay()];
              return (
                <th key={day} style={{ ...thBase, ...getHeaderStyle(day) }} title={day + " — " + dayName}>
                  <div style={{ lineHeight: 1.2 }}>
                    <div>{day}</div>
                    <div style={{ fontSize: 9, opacity: 0.7 }}>{dayName}</div>
                  </div>
                </th>
              );
            })}
            <th style={totalTh}>Дни</th>
            <th style={totalTh}>Часы</th>
            <th style={{ ...thBase, minWidth: 36, width: 36 }}>СВ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employee.id} style={{ height: 36 }}>
              <td style={stickyNameTd} title={row.employee.personnelNumber}>
                <div>
                  <span style={{ fontWeight: 500 }}>{row.employee.fullName}</span>
                  <span style={{ marginLeft: 6, color: "#9ca3af", fontSize: 11 }}>#{row.employee.personnelNumber}</span>
                </div>
                {row.employee.schedule && (
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{row.employee.schedule.name}</div>
                )}
              </td>
              {days.map((day) => {
                const date = new Date(year, month, day);
                const key = formatDateKey(year, month, day);
                const holiday = holidays[key];
                const weekend = isWeekend(date);
                const record = row.records[day] ?? null;
                const secondary = row.secondaryRecords[day] ?? null;
                const cellKey = row.employee.id + ":" + day;
                const sel = selectedCells.has(cellKey);

                if (selectionMode && canEdit) {
                  const bgColor = sel ? "#dbeafe"
                    : record?.markColor ? record.markColor + "33"
                    : holiday && !holiday.isShortened ? "#fff7ed"
                    : holiday?.isShortened ? "#fefce8"
                    : weekend ? "#f3f4f6" : undefined;
                  return (
                    <td
                      key={day}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        isDragging.current = true;
                        onCellSelect?.(row.employee.id, day);
                      }}
                      onMouseEnter={() => {
                        if (isDragging.current) onCellSelect?.(row.employee.id, day);
                      }}
                      style={{
                        minWidth: 36, width: 36, height: 36, textAlign: "center", verticalAlign: "middle",
                        padding: 0, fontSize: 12, fontWeight: 500, cursor: "pointer",
                        border: sel ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                        backgroundColor: bgColor, boxSizing: "border-box", userSelect: "none",
                      }}
                    >
                      {record?.markCode ?? ""}
                    </td>
                  );
                }

                return (
                  <TimesheetCell
                    key={day}
                    employeeId={row.employee.id}
                    day={day}
                    value={record}
                    secondaryValue={secondary}
                    markTypes={markTypes}
                    canEdit={canEdit}
                    isWeekend={weekend}
                    isHoliday={!!holiday && !holiday.isShortened}
                    isShortened={!!holiday && holiday.isShortened}
                    isSelected={sel}
                    onOpen={handleCellOpen}
                  />
                );
              })}
              <td style={{ textAlign: "center", fontSize: 12, fontWeight: 600, border: "1px solid #e5e7eb", padding: "4px 6px", backgroundColor: "#f9fafb" }}>
                {row.totalDays}
              </td>
              <td style={{ textAlign: "center", fontSize: 12, fontWeight: 600, border: "1px solid #e5e7eb", padding: "4px 6px", backgroundColor: "#f9fafb" }}>
                {row.totalHours}
              </td>
              <td style={{
                textAlign: "center", fontSize: 11, fontWeight: 600, border: "1px solid #e5e7eb", padding: "4px 4px",
                backgroundColor: row.totalOvertimeHours > 0 ? "#fef2f2" : "#f9fafb",
                color: row.totalOvertimeHours > 0 ? "#dc2626" : "#9ca3af",
              }}>
                {row.totalOvertimeHours > 0 ? row.totalOvertimeHours : "—"}
              </td>
            </tr>
          ))}

          {rows.length > 1 && (
            <tr style={{ backgroundColor: "#f0fdf4" }}>
              <td style={{ ...stickyNameTd, backgroundColor: "#f0fdf4", fontWeight: 700, color: "#166534" }}>Итого</td>
              {days.map((day) => (
                <td key={day} style={{ minWidth: 36, width: 36, border: "1px solid #e5e7eb", backgroundColor: "#f0fdf4" }} />
              ))}
              <td style={{ textAlign: "center", fontSize: 12, fontWeight: 700, border: "1px solid #e5e7eb", padding: "4px 6px", backgroundColor: "#dcfce7", color: "#166534" }}>{totalDays}</td>
              <td style={{ textAlign: "center", fontSize: 12, fontWeight: 700, border: "1px solid #e5e7eb", padding: "4px 6px", backgroundColor: "#dcfce7", color: "#166534" }}>{totalHours}</td>
              <td style={{ textAlign: "center", fontSize: 11, fontWeight: 700, border: "1px solid #e5e7eb", padding: "4px 6px", backgroundColor: totalOT > 0 ? "#fee2e2" : "#dcfce7", color: totalOT > 0 ? "#dc2626" : "#166534" }}>
                {totalOT > 0 ? totalOT : "—"}
              </td>
            </tr>
          )}

          {rows.length === 0 && (
            <tr>
              <td colSpan={daysInMonth + 4} style={{ textAlign: "center", padding: "24px", color: "#9ca3af", fontSize: 14 }}>
                Нет сотрудников для отображения
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    {freshOpenCell && (
      <CellPopup
        info={freshOpenCell}
        markTypes={markTypes}
        onApply={handlePopupApply}
        onClose={handlePopupClose}
      />
    )}
    </>
  );
}
