"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTHS } from "@/lib/constants";
import type { DepartmentOption } from "@/types";

interface TimesheetFiltersProps {
  year: number;
  month: number;
  departmentId: string;
  departments: DepartmentOption[];
  userRole: string;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onDepartmentChange: (departmentId: string) => void;
}

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

export function TimesheetFilters({
  year,
  month,
  departmentId,
  departments,
  userRole,
  onYearChange,
  onMonthChange,
  onDepartmentChange,
}: TimesheetFiltersProps) {
  const isManager = userRole === "MANAGER";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Выбор месяца */}
      <Select value={String(month)} onValueChange={(v) => onMonthChange(Number(v))}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Месяц" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, idx) => (
            <SelectItem key={idx} value={String(idx)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Выбор года */}
      <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
        <SelectTrigger className="w-24">
          <SelectValue placeholder="Год" />
        </SelectTrigger>
        <SelectContent>
          {YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Выбор подразделения — скрыт для MANAGER */}
      {!isManager && (
        <Select value={departmentId} onValueChange={onDepartmentChange}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Все подразделения" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все подразделения</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
