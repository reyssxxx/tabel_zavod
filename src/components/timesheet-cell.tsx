"use client";

import { useRef } from "react";
import type { TimeRecordData, MarkTypeOption } from "@/types";

export interface CellClickInfo {
  rect: DOMRect;
  employeeId: string;
  day: number;
  value: TimeRecordData | null;
  secondaryValue: TimeRecordData | null | undefined;
}

interface TimesheetCellProps {
  employeeId: string;
  day: number;
  value: TimeRecordData | null;
  secondaryValue?: TimeRecordData | null;
  markTypes: MarkTypeOption[];
  canEdit: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  isShortened: boolean;
  isSelected?: boolean;
  onOpen: (info: CellClickInfo) => void;
}

export function TimesheetCell({
  employeeId,
  day,
  value,
  secondaryValue,
  canEdit,
  isWeekend,
  isHoliday,
  isShortened,
  isSelected = false,
  onOpen,
}: TimesheetCellProps) {
  const cellRef = useRef<HTMLTableCellElement>(null);

  const bg = value?.markColor
    ? value.markColor + "33"
    : isHoliday ? "#fff7ed"
    : isShortened ? "#fefce8"
    : isWeekend ? "#f3f4f6"
    : undefined;

  const cellStyle: React.CSSProperties = {
    minWidth: 36, width: 36, height: 36,
    textAlign: "center", verticalAlign: "middle",
    padding: 0, fontSize: 11, fontWeight: 500,
    cursor: canEdit ? "pointer" : "default",
    border: isSelected ? "2px solid #3b82f6" : "1px solid #e5e7eb",
    position: "relative", boxSizing: "border-box",
    backgroundColor: bg,
  };

  const hasOvertime = (value?.overtimeHours ?? 0) > 0;

  const renderContent = () => {
    if (secondaryValue) {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, borderBottom: "1px solid #e5e7eb",
            backgroundColor: value?.markColor ? value.markColor + "33" : undefined,
          }}>
            {value?.markCode ?? ""}
          </div>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10,
            backgroundColor: secondaryValue.markColor ? secondaryValue.markColor + "33" : undefined,
          }}>
            {secondaryValue.markCode}
          </div>
        </div>
      );
    }
    const hasPartial = value?.actualHours != null;
    return (
      <span style={{ display: "block", position: "relative", lineHeight: hasPartial ? "1.1" : "34px" }}>
        {hasPartial ? (
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 34 }}>
            <span>{value?.markCode ?? ""}</span>
            <span style={{ fontSize: 9, color: "#b45309", fontWeight: 600 }}>{value!.actualHours}ч</span>
          </span>
        ) : (
          value?.markCode ?? ""
        )}
        {hasOvertime && (
          <span style={{
            position: "absolute", top: 2, right: 2, width: 5, height: 5,
            borderRadius: "50%", backgroundColor: "#ef4444",
          }} title={"СВ: " + value!.overtimeHours + "ч"} />
        )}
      </span>
    );
  };

  if (!canEdit) {
    return <td style={cellStyle}>{renderContent()}</td>;
  }

  return (
    <td
      ref={cellRef}
      style={cellStyle}
      onClick={() => {
        const rect = cellRef.current?.getBoundingClientRect();
        if (rect) onOpen({ rect, employeeId, day, value, secondaryValue });
      }}
    >
      {renderContent()}
    </td>
  );
}
