"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTHS } from "@/lib/constants";
import type { DepartmentOption, Role } from "@/types";

const currentYear = new Date().getFullYear();
const YEARS = [
  currentYear - 2,
  currentYear - 1,
  currentYear,
  currentYear + 1,
  currentYear + 2,
];

interface ReportFiltersProps {
  year: number;
  month: number;
  departmentId: string;
  departments: DepartmentOption[];
  userRole: Role;
  onChange: (value: { year: number; month: number; departmentId: string }) => void;
}

export function ReportFilters({
  year,
  month,
  departmentId,
  departments,
  userRole,
  onChange,
}: ReportFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Месяц */}
      <Select
        value={String(month)}
        onValueChange={(v) =>
          onChange({ year, month: Number(v), departmentId })
        }
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, idx) => (
            <SelectItem key={idx} value={String(idx)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Год */}
      <Select
        value={String(year)}
        onValueChange={(v) =>
          onChange({ year: Number(v), month, departmentId })
        }
      >
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Подразделение */}
      <Select
        value={departmentId}
        onValueChange={(v) => onChange({ year, month, departmentId: v })}
        disabled={userRole === "MANAGER"}
      >
        <SelectTrigger className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все подразделения</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
