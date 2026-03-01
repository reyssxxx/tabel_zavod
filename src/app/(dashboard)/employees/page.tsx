"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeeForm } from "@/components/employee-form";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { Plus, Upload, Pencil, UserX, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { EmployeeWithDepartment, DepartmentOption, SessionUser } from "@/types";

const PAGE_SIZE = 20;

export default function EmployeesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user as SessionUser | undefined;
  const role = user?.role;
  const userDeptId = user?.departmentId ?? null;

  const isAccountant = role === "ACCOUNTANT";
  const isAdmin = role === "ADMIN";
  const isHR = role === "HR";
  const isManager = role === "MANAGER";
  const canCreate = isAdmin || isHR;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [employees, setEmployees] = useState<EmployeeWithDepartment[]>([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editEmployee, setEditEmployee] = useState<EmployeeWithDepartment | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setDebouncedSearch(value); setPage(1); }, 300);
  };

  useEffect(() => { setPage(1); }, [departmentFilter, showInactive]);

  useEffect(() => {
    if (!role) return;
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setDepartments(data); })
      .catch(() => toast.error("Ошибка загрузки подразделений"));
  }, [role]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (departmentFilter !== "all") params.set("department", departmentFilter);
      if (showInactive) params.set("showInactive", "true");
      const res = await fetch(`/api/employees?${params.toString()}`);
      if (!res.ok) { toast.error("Ошибка загрузки сотрудников"); return; }
      const data = await res.json();
      setEmployees(data.employees);
      setTotal(data.total);
    } catch { toast.error("Ошибка загрузки сотрудников"); }
    finally { setLoading(false); }
  }, [debouncedSearch, departmentFilter, showInactive, page]);

  useEffect(() => { if (role) fetchEmployees(); }, [fetchEmployees, role]);

  const handleDeactivate = async (emp: EmployeeWithDepartment) => {
    if (!confirm(`Деактивировать сотрудника "${emp.fullName}"?`)) return;
    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Ошибка деактивации");
        return;
      }
      toast.success(`Сотрудник "${emp.fullName}" деактивирован`);
      fetchEmployees();
    } catch { toast.error("Ошибка соединения с сервером"); }
  };

  const canEditEmployee = (emp: EmployeeWithDepartment): boolean => {
    if (isAccountant) return false;
    if (isAdmin || isHR) return true;
    if (isManager) return emp.department.id === userDeptId;
    return false;
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const shownFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const shownTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Сотрудники</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Поиск по ФИО или табельному номеру"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Подразделение" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все подразделения</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Показать неактивных
        </label>
        <div className="flex items-center gap-2 ml-auto">
          {canCreate && (
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />Добавить
            </Button>
          )}
          {canCreate && (
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-1" />Импорт CSV
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ФИО</TableHead>
              <TableHead>Должность</TableHead>
              <TableHead>Подразделение</TableHead>
              <TableHead>Таб. №</TableHead>
              <TableHead>Статус</TableHead>
              {!isAccountant && <TableHead className="w-24 text-right">Действия</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isAccountant ? 5 : 6} className="text-center py-8 text-muted-foreground">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAccountant ? 5 : 6} className="text-center py-8 text-muted-foreground">
                  Сотрудники не найдены
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => (
                <TableRow
                  key={emp.id}
                  className={`cursor-pointer hover:bg-muted/50 transition-colors ${!emp.isActive ? "opacity-60" : ""}`}
                  onClick={() => router.push(`/employees/${emp.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {emp.fullName}
                      {(emp.linkedEmployee || (emp.linkedBy && emp.linkedBy.length > 0)) && (
                        <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 bg-amber-50">
                          Совместитель
                        </Badge>
                      )}
                    </div>
                    {emp.schedule && (
                      <span className="text-xs text-muted-foreground">{emp.schedule.name}</span>
                    )}
                  </TableCell>
                  <TableCell>{emp.position}</TableCell>
                  <TableCell>{emp.department.name}</TableCell>
                  <TableCell>{emp.personnelNumber}</TableCell>
                  <TableCell>
                    {emp.isActive ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">
                        Активен
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Неактивен</Badge>
                    )}
                  </TableCell>
                  {!isAccountant && (
                    <TableCell className="text-right">
                      {canEditEmployee(emp) && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Редактировать"
                            onClick={(e) => { e.stopPropagation(); setEditEmployee(emp); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {emp.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              title="Деактивировать"
                              onClick={(e) => { e.stopPropagation(); handleDeactivate(emp); }}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0 ? "Нет записей" : `Показано ${shownFrom}–${shownTo} из ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />Назад
          </Button>
          <span>{page} / {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Вперёд<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Добавить сотрудника</DialogTitle></DialogHeader>
          <EmployeeForm
            departments={departments}
            onSuccess={() => { setShowAddDialog(false); fetchEmployees(); }}
            onCancel={() => setShowAddDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEmployee} onOpenChange={(open) => !open && setEditEmployee(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Редактировать сотрудника</DialogTitle></DialogHeader>
          {editEmployee && (
            <EmployeeForm
              employee={editEmployee}
              departments={departments}
              onSuccess={() => { setEditEmployee(null); fetchEmployees(); }}
              onCancel={() => setEditEmployee(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <CsvImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={() => { fetchEmployees(); }}
      />

    </div>
  );
}
