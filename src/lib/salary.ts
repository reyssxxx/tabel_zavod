import type { SalaryBreakdown } from "@/types";

/** Default OT coefficients (stored in AppSettings, these are fallbacks) */
export const DEFAULT_OT_COEF_1 = 1.5;
export const DEFAULT_OT_COEF_2 = 2.0;
export const DEFAULT_OT_THRESHOLD = 2;

/** Default weekend/holiday coefficients (ТК РФ ст.153 — не менее ×2) */
export const DEFAULT_WEEKEND_COEF = 2.0;
export const DEFAULT_HOLIDAY_COEF = 2.0;

/** Среднемесячное число календарных дней по ТК РФ ст.139 */
export const AVG_CALENDAR_DAYS_PER_MONTH = 29.3;

/**
 * Count normative working days in a month, excluding weekends and non-shortened holidays.
 */
export function getNormWorkdays(
  year: number,
  month: number,
  holidays: Map<string, { name: string; isShortened: boolean }>
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const holiday = holidays.get(key);
    if (holiday && !holiday.isShortened) continue;
    count++;
  }
  return count;
}

/**
 * Calculate salary breakdown for an employee for a given month.
 *
 * workedHours  — hours on normal workdays (weekday, not a holiday)
 * weekendHours — hours on Saturday/Sunday (automatically detected by date)
 * holidayHours — hours on non-shortened holidays (automatically detected by date)
 * otHours      — overtime hours (overtimeHours field, applies to any day)
 *
 * Weekend/holiday hours are paid at full coef rate (not added on top of regular pay —
 * they are excluded from workedHours, so there's no double-counting).
 */
export function calculateSalary(params: {
  baseSalary: number;
  normHours: number;
  normDays: number;       // normWorkdays — for sick pay daily rate
  workedHours: number;
  otHours: number;
  weekendHours: number;
  holidayHours: number;
  sickDays: number;
  vacationDays: number;   // days with "ОТ" mark
  experienceYears: number;
  otCoef1?: number;
  otCoef2?: number;
  otThreshold?: number;
  weekendCoef?: number;
  holidayCoef?: number;
}): SalaryBreakdown {
  const {
    baseSalary,
    normHours,
    normDays,
    workedHours,
    otHours,
    weekendHours,
    holidayHours,
    sickDays,
    vacationDays,
    experienceYears,
    otCoef1 = DEFAULT_OT_COEF_1,
    otCoef2 = DEFAULT_OT_COEF_2,
    otThreshold = DEFAULT_OT_THRESHOLD,
    weekendCoef = DEFAULT_WEEKEND_COEF,
    holidayCoef = DEFAULT_HOLIDAY_COEF,
  } = params;

  const sickPayRate = getSickPayRate(experienceYears);
  // Среднедневной заработок по ТК РФ ст.139 (оклад / 29.3)
  const avgDailyRate = baseSalary / AVG_CALENDAR_DAYS_PER_MONTH;

  if (normHours <= 0 || baseSalary <= 0) {
    return {
      baseSalary, normHours, workedHours, otHours, weekendHours, holidayHours,
      sickDays, sickPayRate, vacationDays, avgDailyRate, experienceYears,
      hourlyRate: 0, regularPay: 0, otPay: 0, weekendPay: 0, holidayPay: 0,
      sickPay: 0, vacationPay: 0, totalPay: 0, hasSalary: true,
    };
  }

  const hourlyRate = baseSalary / normHours;
  const regularPay = hourlyRate * workedHours;

  const otHours1 = Math.min(otHours, otThreshold);
  const otHours2 = Math.max(0, otHours - otThreshold);
  const otPay = otHours1 * hourlyRate * otCoef1 + otHours2 * hourlyRate * otCoef2;

  const weekendPay = weekendHours * hourlyRate * weekendCoef;
  const holidayPay = holidayHours * hourlyRate * holidayCoef;

  // Оплата больничного: дневная ставка = оклад / норм. дней × sickPayRate × кол-во дней
  const dailyRate = normDays > 0 ? baseSalary / normDays : 0;
  const sickPay = dailyRate * sickPayRate * sickDays;

  // Отпускные: среднедневной × кол-во дней отпуска (ТК РФ ст.139)
  const vacationPay = avgDailyRate * vacationDays;

  return {
    baseSalary, normHours, workedHours, otHours, weekendHours, holidayHours,
    sickDays, sickPayRate, vacationDays, avgDailyRate, experienceYears,
    hourlyRate,
    regularPay,
    otPay,
    weekendPay,
    holidayPay,
    sickPay,
    vacationPay,
    totalPay: regularPay + otPay + weekendPay + holidayPay + sickPay + vacationPay,
    hasSalary: true,
  };
}

/**
 * Стаж в полных годах на указанную дату.
 */
export function getExperienceYears(hireDate: Date, asOf: Date = new Date()): number {
  const years = asOf.getFullYear() - hireDate.getFullYear();
  const hadBirthday =
    asOf.getMonth() > hireDate.getMonth() ||
    (asOf.getMonth() === hireDate.getMonth() && asOf.getDate() >= hireDate.getDate());
  return hadBirthday ? years : years - 1;
}

/**
 * Процент оплаты больничного по ТК РФ ст.7 (закон № 255-ФЗ):
 *   < 5 лет  → 60%
 *   5–8 лет  → 80%
 *   ≥ 8 лет  → 100%
 */
export function getSickPayRate(experienceYears: number): number {
  if (experienceYears < 5) return 0.6;
  if (experienceYears < 8) return 0.8;
  return 1.0;
}

/** Format a number as Russian rubles with thousands separator */
export function formatRub(amount: number): string {
  return amount.toLocaleString("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
}
