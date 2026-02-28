"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "next-auth/react";
import type { EmployeeWithDepartment, DepartmentOption, WorkScheduleOption, SessionUser } from "@/types";

interface EmployeeFormProps {
  employee?: EmployeeWithDepartment;
  departments: DepartmentOption[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function EmployeeForm({
  employee,
  departments,
  onSuccess,
  onCancel,
}: EmployeeFormProps) {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;

  const [fullName, setFullName] = useState(employee?.fullName ?? "");
  const [position, setPosition] = useState(employee?.position ?? "");
  const [departmentId, setDepartmentId] = useState(employee?.department.id ?? "");
  const [personnelNumber, setPersonnelNumber] = useState(employee?.personnelNumber ?? "");
  const [scheduleId, setScheduleId] = useState(employee?.schedule?.id ?? "none");
  const [linkedEmployeeSearch, setLinkedEmployeeSearch] = useState("");
  const [linkedEmployee, setLinkedEmployee] = useState<EmployeeWithDepartment | null>(
    employee?.linkedEmployee
      ? ({ ...employee.linkedEmployee, position: "", personnelNumber: "", isActive: true } as EmployeeWithDepartment)
      : null
  );
  const [searchResults, setSearchResults] = useState<EmployeeWithDepartment[]>([]);
  const [schedules, setSchedules] = useState<WorkScheduleOption[]>([]);
  const [loading, setLoading] = useState(false);

  const isEditing = !!employee;
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    fetch("/api/settings/schedules")
      .then((r) => r.json())
      .then(setSchedules)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!linkedEmployeeSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/employees?search=" + encodeURIComponent(linkedEmployeeSearch) + "&pageSize=5");
        const data = await res.json();
        const filtered = (data.employees || []).filter(
          (e: EmployeeWithDepartment) => !employee || e.id !== employee.id
        );
        setSearchResults(filtered);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [linkedEmployeeSearch, employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !position.trim() || !departmentId || !personnelNumber.trim()) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    setLoading(true);
    try {
      const url = isEditing ? "/api/employees/" + employee.id : "/api/employees";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          position: position.trim(),
          departmentId,
          personnelNumber: personnelNumber.trim(),
          scheduleId: scheduleId === "none" ? null : scheduleId,
          linkedEmployeeId: linkedEmployee?.id ?? null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Ошибка при сохранении");
        return;
      }

      toast.success(isEditing ? "Сотрудник обновлён" : "Сотрудник добавлен");
      onSuccess();
    } catch {
      toast.error("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">ФИО *</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Иванов Иван Иванович"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="position">Должность *</Label>
        <Input
          id="position"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Сборщик-клепальщик"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">Подразделение *</Label>
        <Select value={departmentId} onValueChange={setDepartmentId} required>
          <SelectTrigger id="department">
            <SelectValue placeholder="Выберите подразделение" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="personnelNumber">Табельный номер *</Label>
        <Input
          id="personnelNumber"
          value={personnelNumber}
          onChange={(e) => setPersonnelNumber(e.target.value)}
          placeholder="101"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="schedule">График работы</Label>
        <Select value={scheduleId} onValueChange={setScheduleId}>
          <SelectTrigger id="schedule">
            <SelectValue placeholder="Стандартный (8ч)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Стандартный (8ч)</SelectItem>
            {schedules.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.hoursPerDay}ч)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isAdmin && (
        <div className="space-y-2">
          <Label>Совместитель (связать с другой записью)</Label>
          {linkedEmployee ? (
            <div className="flex items-center gap-2 p-2 border rounded-md bg-amber-50">
              <span className="text-sm flex-1">
                {linkedEmployee.fullName}
                {linkedEmployee.department?.name && (
                  <span className="text-muted-foreground"> &middot; {linkedEmployee.department.name}</span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setLinkedEmployee(null); setLinkedEmployeeSearch(""); }}
              >
                Сбросить
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                value={linkedEmployeeSearch}
                onChange={(e) => setLinkedEmployeeSearch(e.target.value)}
                placeholder="Поиск по ФИО..."
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border rounded-md shadow-md mt-1 max-h-40 overflow-y-auto">
                  {searchResults.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                      onClick={() => {
                        setLinkedEmployee(emp);
                        setLinkedEmployeeSearch("");
                        setSearchResults([]);
                      }}
                    >
                      {emp.fullName}
                      <span className="text-muted-foreground"> &middot; {emp.department?.name} &middot; #{emp.personnelNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Отмена
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Сохранение..." : isEditing ? "Сохранить" : "Добавить"}
        </Button>
      </div>
    </form>
  );
}