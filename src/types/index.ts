export type Role = "ADMIN" | "MANAGER" | "ACCOUNTANT";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface MarkTypeOption {
  id: string;
  code: string;
  name: string;
  defaultHours: number;
  color: string;
}

export interface WorkScheduleOption {
  id: string;
  name: string;
  hoursPerDay: number;
}

export interface EmployeeWithDepartment {
  id: string;
  fullName: string;
  position: string;
  personnelNumber: string;
  isActive: boolean;
  department: {
    id: string;
    name: string;
  };
  schedule?: WorkScheduleOption | null;
  linkedEmployee?: { id: string; fullName: string; department: { name: string } } | null;
  linkedBy?: { id: string; fullName: string; department: { name: string } }[];
}

export interface TimeRecordData {
  employeeId: string;
  date: string; // ISO date string
  markTypeId: string | null;
  markCode: string | null;
  markColor: string | null;
  overtimeHours?: number;
  slot?: number;
}

export interface TimesheetRow {
  employee: {
    id: string;
    fullName: string;
    personnelNumber: string;
    schedule?: WorkScheduleOption | null;
  };
  records: Record<number, TimeRecordData>; // day number -> record (slot=0)
  secondaryRecords: Record<number, TimeRecordData>; // slot=1 (half-day second mark)
  totalDays: number;
  totalHours: number;
  totalOvertimeHours: number;
}

export interface ReportData {
  departmentId: string;
  departmentName: string;
  totalEmployees: number;
  workDays: number;
  vacationDays: number;
  sickDays: number;
  businessTripDays: number;
  absentDays: number;
  shortenedDays: number;
  // Вычисляемые метрики
  totalWorkHours: number;    // сумма часов по всем "Я" записям подразделения
  attendanceRate: number;    // % явки 0–100.0, знаменатель — рабочие дни до сегодня
  workdaysInPeriod: number;  // рабочих дней в знаменателе (для подсказки в UI)
  unmarkedDays: number;      // рабочих дней × сотрудников − всех отметок за период
}

export interface HolidayRecord {
  id: string;
  date: string; // "YYYY-MM-DD"
  name: string;
  isShortened: boolean;
}

export interface DepartmentWithCount {
  id: string;
  name: string;
  employeeCount: number;
}
