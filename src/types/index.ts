export type Role = "ADMIN" | "MANAGER" | "ACCOUNTANT" | "HR";

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

export interface PositionOption {
  id: string;
  name: string;
  baseSalary: number;
  employeeCount?: number;
}

export interface SalaryBreakdown {
  baseSalary: number;
  normHours: number;
  workedHours: number;    // normal working day hours
  otHours: number;        // overtime hours (overtimeHours field)
  weekendHours: number;   // hours worked on weekends
  holidayHours: number;   // hours worked on non-shortened holidays
  sickDays: number;       // days with "Б" mark
  sickPayRate: number;    // 0.6 / 0.8 / 1.0 based on experience
  experienceYears: number;
  vacationDays: number;   // days with "ОТ" mark
  avgDailyRate: number;   // baseSalary / 29.3 (ТК РФ ст.139)
  hourlyRate: number;
  regularPay: number;
  otPay: number;
  weekendPay: number;
  holidayPay: number;
  sickPay: number;        // sick leave payment
  vacationPay: number;    // vacation payment (avgDailyRate × vacationDays)
  totalPay: number;
  hasSalary: boolean;
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
  hireDate?: string | null;
  schedule?: WorkScheduleOption | null;
  positionRef?: PositionOption | null;
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
  actualHours?: number | null; // null = полный день по графику; число = фактически отработано
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
  totalSalary: number;       // суммарный ФОТ по подразделению
  avgSalary: number;         // средняя ЗП (по сотрудникам с positionRef)
  salaryEmployeeCount: number; // кол-во сотрудников с назначенной должностью
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

export interface AuditLogRow {
  id: string;
  entityType: string;
  action: string;
  entityId: string;
  userId: string;
  userName: string;
  userRole: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AuditUserOption {
  userId: string;
  userName: string;
}
