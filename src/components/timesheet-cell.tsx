"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TimeRecordData, MarkTypeOption } from "@/types";

interface TimesheetCellProps {
  value: TimeRecordData | null;
  markTypes: MarkTypeOption[];
  canEdit: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  isShortened: boolean;
  isSelected?: boolean;
  onSelect: (markTypeId: string | null) => void;
}

export function TimesheetCell({
  value,
  markTypes,
  canEdit,
  isWeekend,
  isHoliday,
  isShortened,
  isSelected = false,
  onSelect,
}: TimesheetCellProps) {
  const cellStyle: React.CSSProperties = {
    minWidth: 36,
    width: 36,
    height: 36,
    textAlign: "center",
    verticalAlign: "middle",
    padding: 0,
    fontSize: 12,
    fontWeight: 500,
    cursor: canEdit ? "pointer" : "default",
    border: isSelected ? "2px solid #3b82f6" : "1px solid #e5e7eb",
    position: "relative",
    boxSizing: "border-box",
  };

  // Определяем фоновый цвет
  if (value?.markColor) {
    cellStyle.backgroundColor = `${value.markColor}33`;
  } else if (isHoliday) {
    cellStyle.backgroundColor = "#fff7ed"; // bg-orange-50
  } else if (isShortened) {
    cellStyle.backgroundColor = "#fefce8"; // bg-yellow-50
  } else if (isWeekend) {
    cellStyle.backgroundColor = "#f3f4f6"; // bg-gray-100
  }

  const content = (
    <td style={cellStyle}>
      {value?.markCode ?? (isHoliday || isWeekend ? "" : "")}
    </td>
  );

  if (!canEdit) {
    return content;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <td style={{ ...cellStyle, outline: "none" }}>
          <span style={{ display: "block", lineHeight: "36px" }}>
            {value?.markCode ?? ""}
          </span>
        </td>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {markTypes.map((mt) => (
          <DropdownMenuItem
            key={mt.id}
            onClick={() => onSelect(mt.id)}
            className="gap-2 cursor-pointer"
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: mt.color,
                flexShrink: 0,
              }}
            />
            <span className="font-mono font-semibold text-xs w-6">{mt.code}</span>
            <span className="text-sm">{mt.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onSelect(null)}
          className="cursor-pointer text-muted-foreground"
        >
          Очистить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
