import * as XLSX from "xlsx";
import { stringify } from "csv-stringify/sync";
import { MONTHS } from "@/lib/constants";
import { isWeekend } from "@/lib/holidays";
import type { TimesheetRow, ReportData } from "@/types";

export function generateTimesheetXlsx(
  data: TimesheetRow[],
  month: number,
  year: number,
  departmentName: string
): Buffer {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Build array of arrays
  const aoa: (string | number)[][] = [
    [`Табель учёта рабочего времени за ${MONTHS[month]} ${year} — ${departmentName}`],
    [],
    ["ФИО", ...days, "Дни", "Часы"],
    ...data.map((row) => [
      row.employee.fullName,
      ...days.map((d) => row.records[d]?.markCode ?? ""),
      row.totalDays,
      row.totalHours,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merge title cell across all columns
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: daysInMonth + 2 } }];

  // Column widths
  ws["!cols"] = [
    { wch: 30 },
    ...days.map(() => ({ wch: 4 })),
    { wch: 6 },
    { wch: 6 },
  ];

  // Title cell styling
  const titleAddr = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (!ws[titleAddr]) ws[titleAddr] = { t: "s", v: "" };
  ws[titleAddr].s = {
    font: { bold: true, sz: 12 },
    alignment: { horizontal: "center" },
  };

  // Header row styling (row index 2)
  for (let c = 0; c <= daysInMonth + 2; c++) {
    const addr = XLSX.utils.encode_cell({ r: 2, c });
    if (!ws[addr]) ws[addr] = { t: "z" };
    ws[addr].s = { font: { bold: true }, alignment: { horizontal: "center" } };
  }

  // Data rows styling (row index 3+)
  const dataRowStart = 3;
  for (let ri = 0; ri < data.length; ri++) {
    const row = data[ri];
    for (let di = 0; di < days.length; di++) {
      const d = days[di];
      const colIndex = di + 1; // col 0 is ФИО
      const rowIndex = dataRowStart + ri;

      const isWe = isWeekend(new Date(year, month, d));
      const record = row.records[d];

      const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!ws[addr]) ws[addr] = { t: "z" };

      if (record?.markColor) {
        const argb = "FF" + record.markColor.replace("#", "").toUpperCase();
        ws[addr].s = {
          fill: { fgColor: { rgb: argb } },
          alignment: { horizontal: "center" },
        };
      } else if (isWe) {
        ws[addr].s = {
          fill: { fgColor: { rgb: "FFD9D9D9" } },
          alignment: { horizontal: "center" },
        };
      } else {
        ws[addr].s = { alignment: { horizontal: "center" } };
      }
    }

    // Header cells for weekends (row 2)
    for (let di = 0; di < days.length; di++) {
      const d = days[di];
      const colIndex = di + 1;
      const isWe = isWeekend(new Date(year, month, d));
      if (isWe) {
        const headerAddr = XLSX.utils.encode_cell({ r: 2, c: colIndex });
        if (!ws[headerAddr]) ws[headerAddr] = { t: "z" };
        ws[headerAddr].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "FFD9D9D9" } },
          alignment: { horizontal: "center" },
        };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Табель");

  return XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  }) as Buffer;
}

export function generateTimesheetCsv(
  data: TimesheetRow[],
  month: number,
  year: number
): string {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const header = ["ФИО", ...days.map(String), "Дни", "Часы"];
  const rows = data.map((row) => [
    row.employee.fullName,
    ...days.map((d) => row.records[d]?.markCode ?? ""),
    String(row.totalDays),
    String(row.totalHours),
  ]);

  const csv = stringify([header, ...rows], { delimiter: ";" });
  return "\uFEFF" + csv;
}

export function generateReportTxt(
  reportData: ReportData[],
  month: number,
  year: number
): string {
  const lines: string[] = [
    "ОТЧЁТ ПО ПОДРАЗДЕЛЕНИЯМ",
    `За ${MONTHS[month]} ${year}`,
    "===========================",
    "",
  ];

  for (const dept of reportData) {
    lines.push(`Подразделение: ${dept.departmentName}`);
    lines.push(`Сотрудников: ${dept.totalEmployees}`);
    lines.push(`Рабочих дней (период): ${dept.workdaysInPeriod}`);
    lines.push(`Явка: ${dept.attendanceRate}%`);
    lines.push(`Отработано часов: ${dept.totalWorkHours}`);
    lines.push(`Дней явки: ${dept.workDays}`);
    lines.push(`Дней отпуска: ${dept.vacationDays}`);
    lines.push(`Дней больничного: ${dept.sickDays}`);
    lines.push(`Командировок: ${dept.businessTripDays}`);
    lines.push(`Прогулов: ${dept.absentDays}`);
    if (dept.shortenedDays > 0) {
      lines.push(`Сокращённых дней: ${dept.shortenedDays}`);
    }
    if (dept.unmarkedDays > 0) {
      lines.push(`Незаполненных дней: ${dept.unmarkedDays}`);
    }
    lines.push("---------------------------");
    lines.push("");
  }

  return lines.join("\n");
}
