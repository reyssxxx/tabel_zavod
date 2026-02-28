import { prisma } from "./db";

let holidayCache: Map<string, { name: string; isShortened: boolean }> | null = null;

export async function loadHolidays() {
  if (holidayCache) return holidayCache;

  const holidays = await prisma.holiday.findMany();
  holidayCache = new Map();

  for (const h of holidays) {
    const key = h.date.toISOString().split("T")[0];
    holidayCache.set(key, { name: h.name, isShortened: h.isShortened });
  }

  return holidayCache;
}

export function invalidateHolidayCache() {
  holidayCache = null;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
