import * as XLSX from "xlsx";
import { stringify } from "csv-stringify/sync";
import { MONTHS } from "@/lib/constants";
import { isWeekend, formatDateKey } from "@/lib/holidays";
import type { TimesheetRow, ReportData } from "@/types";

// ─── Цветовая палитра ──────────────────────────────────────────────────────
const C = {
  TITLE_BG:     "FF1E3A5F",
  TITLE_FG:     "FFFFFFFF",
  ORG_BG:       "FF2D5282",
  ORG_FG:       "FFFFFFFF",
  HDR_NUM_BG:   "FF334D6E",
  HDR_NUM_FG:   "FFFFFFFF",
  HDR_DOW_BG:   "FF4A6FA5",
  HDR_DOW_FG:   "FFFFFFFF",
  HDR_WE_BG:    "FF78909C",
  HDR_HOL_BG:   "FFFF8F00",
  HDR_TOTAL_BG: "FF1B4F72",
  HDR_TOTAL_FG: "FFFFFFFF",
  NAME_BG:      "FFE8F0FB",
  NAME_EVEN_BG: "FFF0F4FA",
  WEEKEND_BG:   "FFCFD8DC",
  HOLIDAY_BG:   "FFFCE8D5",
  PRE_HOL_BG:   "FFFFFDE7",
  TOTALS_BG:    "FFD5E8D4",
  SUM_BG:       "FFB2DFDB",
  HOURS_BG:     "FFF7F9FF",
  HOURS_EVEN:   "FFEEF2FA",
  OT_FG:        "FFBF0000",
  BORDER:       "FFB0BEC5",
  BORDER_THICK: "FF334D6E",
  TEXT_DIM:     "FF607D8B",
  TEXT_DARK:    "FF1A237E",
};

const DOW_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function thinBorder(color = C.BORDER) {
  const b = { style: "thin", color: { rgb: color } };
  return { top: b, bottom: b, left: b, right: b };
}
function medBorder() {
  const b = { style: "medium", color: { rgb: C.BORDER_THICK } };
  return { top: b, bottom: b, left: b, right: b };
}

function setCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  value: string | number,
  style: object
) {
  const addr = XLSX.utils.encode_cell({ r, c });
  ws[addr] = { t: typeof value === "number" ? "n" : "s", v: value, s: style };
}

function styleCell(ws: XLSX.WorkSheet, r: number, c: number, style: object) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) ws[addr] = { t: "z", v: "" };
  ws[addr].s = style;
}

// Осветляем hex-цвет: смешиваем с белым на factor (0..1 — насколько оставить оригинал)
function lightenHex(hex: string, factor = 0.4): string {
  const h = hex.replace("#", "");
  const mix = (v: number) =>
    Math.round(parseInt(h.slice(v, v + 2), 16) * factor + 255 * (1 - factor))
      .toString(16).padStart(2, "0").toUpperCase();
  return "FF" + mix(0) + mix(2) + mix(4);
}

// T-13 style: две строки на сотрудника — коды + часы
export function generateTimesheetXlsx(
  data: TimesheetRow[],
  month: number,
  year: number,
  departmentName: string,
  holidays: Record<string, { name: string; isShortened: boolean }> = {}
): Buffer {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Индексы столбцов
  const COL_N    = 0;
  const COL_NAME = 1;
  const COL_TAB  = 2;
  const COL_SCH  = 3;
  const COL_DAY  = 4;
  const COL_TOT_DAYS  = COL_DAY + daysInMonth;
  const COL_TOT_HOURS = COL_TOT_DAYS + 1;
  const COL_OT        = COL_TOT_HOURS + 1;
  const totalCols     = COL_OT + 1;

  // Индексы строк
  const R_TITLE   = 0;
  const R_ORG     = 1;
  const R_DEPT    = 2;
  const R_PERIOD  = 3;
  const R_SPACER  = 4;
  const R_HDR_NUM = 5;
  const R_HDR_DOW = 6;
  const DATA_START = 7;

  // Инициализируем лист пустыми строками
  const ws: XLSX.WorkSheet = { "!ref": `A1:${XLSX.utils.encode_cell({ r: DATA_START + data.length * 2 + 5, c: totalCols - 1 })}` };
  const merges: XLSX.Range[] = [];

  // ─── Шапка ─────────────────────────────────────────────────────────────
  setCell(ws, R_TITLE, 0, "ТАБЕЛЬ УЧЁТА РАБОЧЕГО ВРЕМЕНИ (Т-13)", {
    font: { bold: true, sz: 14, color: { rgb: C.TITLE_FG } },
    fill: { fgColor: { rgb: C.TITLE_BG } },
    alignment: { horizontal: "center", vertical: "center" },
    border: medBorder(),
  });
  merges.push({ s: { r: R_TITLE, c: 0 }, e: { r: R_TITLE, c: totalCols - 1 } });

  setCell(ws, R_ORG, 0, "АО «ТАНТК им. Г.М. Бериева»", {
    font: { bold: true, sz: 11, color: { rgb: C.ORG_FG } },
    fill: { fgColor: { rgb: C.ORG_BG } },
    alignment: { horizontal: "center", vertical: "center" },
    border: medBorder(),
  });
  merges.push({ s: { r: R_ORG, c: 0 }, e: { r: R_ORG, c: totalCols - 1 } });

  setCell(ws, R_DEPT, 0, `Подразделение: ${departmentName}`, {
    font: { bold: true, sz: 11, color: { rgb: C.ORG_FG } },
    fill: { fgColor: { rgb: C.ORG_BG } },
    alignment: { horizontal: "center", vertical: "center" },
    border: medBorder(),
  });
  merges.push({ s: { r: R_DEPT, c: 0 }, e: { r: R_DEPT, c: totalCols - 1 } });

  setCell(ws, R_PERIOD, 0, `Период: ${MONTHS[month]} ${year} г.`, {
    font: { italic: true, sz: 10, color: { rgb: C.ORG_FG } },
    fill: { fgColor: { rgb: C.ORG_BG } },
    alignment: { horizontal: "center", vertical: "center" },
    border: medBorder(),
  });
  merges.push({ s: { r: R_PERIOD, c: 0 }, e: { r: R_PERIOD, c: totalCols - 1 } });

  // Пустой разделитель
  for (let c = 0; c < totalCols; c++) {
    styleCell(ws, R_SPACER, c, { fill: { fgColor: { rgb: "FFFFFFFF" } } });
  }

  // ─── Заголовки ─────────────────────────────────────────────────────────
  const totalHdrStyle = {
    font: { bold: true, sz: 9, color: { rgb: C.HDR_TOTAL_FG } },
    fill: { fgColor: { rgb: C.HDR_TOTAL_BG } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: medBorder(),
  };
  const metaLabels: [number, string][] = [
    [COL_N,    "№"],
    [COL_NAME, "ФИО сотрудника"],
    [COL_TAB,  "Таб.№"],
    [COL_SCH,  "График"],
  ];
  for (const [col, label] of metaLabels) {
    setCell(ws, R_HDR_NUM, col, label, totalHdrStyle);
    styleCell(ws, R_HDR_DOW, col, totalHdrStyle);
    merges.push({ s: { r: R_HDR_NUM, c: col }, e: { r: R_HDR_DOW, c: col } });
  }
  for (const [col, label] of [[COL_TOT_DAYS, "Дней"], [COL_TOT_HOURS, "Часов"], [COL_OT, "СВ ч."]] as [number, string][]) {
    setCell(ws, R_HDR_NUM, col, label, totalHdrStyle);
    styleCell(ws, R_HDR_DOW, col, totalHdrStyle);
    merges.push({ s: { r: R_HDR_NUM, c: col }, e: { r: R_HDR_DOW, c: col } });
  }

  // Дни — номера и дни недели
  for (let di = 0; di < daysInMonth; di++) {
    const d = di + 1;
    const col = COL_DAY + di;
    const dateObj = new Date(year, month, d);
    const we = isWeekend(dateObj);
    const holKey = formatDateKey(year, month, d);
    const hol = holidays[holKey];
    const isHol = !!hol && !hol.isShortened;

    const numBg = isHol ? C.HDR_HOL_BG : we ? C.HDR_WE_BG : C.HDR_NUM_BG;
    const dowBg = isHol ? C.HDR_HOL_BG : we ? C.HDR_WE_BG : C.HDR_DOW_BG;
    const fg = we || isHol ? "FFFFFFFF" : C.HDR_NUM_FG;

    setCell(ws, R_HDR_NUM, col, d, {
      font: { bold: true, sz: 9, color: { rgb: fg } },
      fill: { fgColor: { rgb: numBg } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder(),
    });
    setCell(ws, R_HDR_DOW, col, DOW_RU[dateObj.getDay()], {
      font: { bold: true, sz: 8, color: { rgb: fg } },
      fill: { fgColor: { rgb: dowBg } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder(),
    });
  }

  // ─── Строки данных ──────────────────────────────────────────────────────
  for (let ri = 0; ri < data.length; ri++) {
    const row = data[ri];
    const rCodes = DATA_START + ri * 2;
    const rHours = rCodes + 1;
    const isEven = ri % 2 === 1;
    const nameBg  = isEven ? C.NAME_EVEN_BG : C.NAME_BG;
    const hoursBg = isEven ? C.HOURS_EVEN    : C.HOURS_BG;

    // № (объединяем две строки)
    setCell(ws, rCodes, COL_N, ri + 1, {
      font: { sz: 9, color: { rgb: C.TEXT_DIM } },
      fill: { fgColor: { rgb: nameBg } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder(),
    });
    styleCell(ws, rHours, COL_N, { fill: { fgColor: { rgb: hoursBg } }, border: thinBorder() });
    merges.push({ s: { r: rCodes, c: COL_N }, e: { r: rHours, c: COL_N } });

    // ФИО (объединяем)
    setCell(ws, rCodes, COL_NAME, row.employee.fullName, {
      font: { bold: true, sz: 10 },
      fill: { fgColor: { rgb: nameBg } },
      alignment: { vertical: "center" },
      border: thinBorder(),
    });
    styleCell(ws, rHours, COL_NAME, { fill: { fgColor: { rgb: hoursBg } }, border: thinBorder() });
    merges.push({ s: { r: rCodes, c: COL_NAME }, e: { r: rHours, c: COL_NAME } });

    // Таб.№ (объединяем)
    setCell(ws, rCodes, COL_TAB, row.employee.personnelNumber, {
      font: { sz: 9, color: { rgb: C.TEXT_DIM } },
      fill: { fgColor: { rgb: nameBg } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder(),
    });
    styleCell(ws, rHours, COL_TAB, { fill: { fgColor: { rgb: hoursBg } }, border: thinBorder() });
    merges.push({ s: { r: rCodes, c: COL_TAB }, e: { r: rHours, c: COL_TAB } });

    // График (объединяем)
    setCell(ws, rCodes, COL_SCH, row.employee.schedule?.name ?? "8-часовой", {
      font: { sz: 8, italic: true, color: { rgb: C.TEXT_DIM } },
      fill: { fgColor: { rgb: nameBg } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: thinBorder(),
    });
    styleCell(ws, rHours, COL_SCH, { fill: { fgColor: { rgb: hoursBg } }, border: thinBorder() });
    merges.push({ s: { r: rCodes, c: COL_SCH }, e: { r: rHours, c: COL_SCH } });

    // Ячейки дней
    for (let di = 0; di < daysInMonth; di++) {
      const d = di + 1;
      const col = COL_DAY + di;
      const dateObj = new Date(year, month, d);
      const we = isWeekend(dateObj);
      const holKey = formatDateKey(year, month, d);
      const hol = holidays[holKey];
      const isHol = !!hol && !hol.isShortened;
      const isPreHol = !!hol?.isShortened;

      const record = row.records[d];
      const secRecord = row.secondaryRecords[d];

      // Фон: цвет отметки (осветлённый) > праздник > пред-праздник > выходной > обычный
      let cellBg: string;
      if (record?.markColor) {
        cellBg = lightenHex(record.markColor, 0.4);
      } else if (isHol) {
        cellBg = C.HOLIDAY_BG;
      } else if (isPreHol) {
        cellBg = C.PRE_HOL_BG;
      } else if (we) {
        cellBg = C.WEEKEND_BG;
      } else {
        cellBg = isEven ? "FFF5F8FF" : "FFFFFFFF";
      }

      // Строка кодов
      const codeVal = record
        ? (secRecord ? `${record.markCode}/${secRecord.markCode}` : (record.markCode ?? ""))
        : "";
      setCell(ws, rCodes, col, codeVal, {
        font: { bold: !!record, sz: 10, color: { rgb: we || isHol ? "FF4A148C" : C.TEXT_DARK } },
        fill: { fgColor: { rgb: cellBg } },
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder(),
      });

      // Строка часов
      let hoursVal: string | number = "";
      if (record) {
        const schedH = row.employee.schedule?.hoursPerDay ?? 8;
        const actualH = record.actualHours ?? schedH;
        const ot = record.overtimeHours ?? 0;
        hoursVal = ot > 0 ? `${actualH}+${ot}` : actualH;
      }
      const hasOT = typeof hoursVal === "string" && hoursVal.includes("+");
      const hoursBgCell = we || isHol
        ? (isHol ? "FFFDE8E8" : "FFECEFF1")
        : (isEven ? C.HOURS_EVEN : C.HOURS_BG);
      setCell(ws, rHours, col, hoursVal, {
        font: { sz: 8, color: { rgb: hasOT ? C.OT_FG : C.TEXT_DIM } },
        fill: { fgColor: { rgb: hoursBgCell } },
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder(),
      });
    }

    // Итоговые ячейки
    const totBorder = medBorder();
    setCell(ws, rCodes, COL_TOT_DAYS, row.totalDays, {
      font: { bold: true, sz: 11, color: { rgb: "FF1B4F72" } },
      fill: { fgColor: { rgb: C.TOTALS_BG } },
      alignment: { horizontal: "center", vertical: "center" },
      border: totBorder,
    });
    setCell(ws, rCodes, COL_TOT_HOURS, row.totalHours, {
      font: { bold: true, sz: 11, color: { rgb: "FF1B4F72" } },
      fill: { fgColor: { rgb: C.TOTALS_BG } },
      alignment: { horizontal: "center", vertical: "center" },
      border: totBorder,
    });
    setCell(ws, rCodes, COL_OT, row.totalOvertimeHours > 0 ? row.totalOvertimeHours : "", {
      font: { bold: row.totalOvertimeHours > 0, sz: 11, color: { rgb: row.totalOvertimeHours > 0 ? C.OT_FG : "FF9E9E9E" } },
      fill: { fgColor: { rgb: C.TOTALS_BG } },
      alignment: { horizontal: "center", vertical: "center" },
      border: totBorder,
    });
    // Строка часов в итоговых — просто заливка
    for (const col of [COL_TOT_DAYS, COL_TOT_HOURS, COL_OT]) {
      styleCell(ws, rHours, col, { fill: { fgColor: { rgb: C.TOTALS_BG } }, border: totBorder });
      merges.push({ s: { r: rCodes, c: col }, e: { r: rHours, c: col } });
    }
  }

  // ─── Строка итогов по подразделению ───────────────────────────────────
  const sumRow = DATA_START + data.length * 2;
  const sumDays  = data.reduce((s, r) => s + r.totalDays, 0);
  const sumHours = data.reduce((s, r) => s + r.totalHours, 0);
  const sumOT    = data.reduce((s, r) => s + r.totalOvertimeHours, 0);

  const sumBase = {
    fill: { fgColor: { rgb: C.SUM_BG } },
    border: medBorder(),
  };
  setCell(ws, sumRow, COL_N, "", sumBase as object);
  setCell(ws, sumRow, COL_NAME, `Итого по подразделению: ${data.length} чел.`, {
    ...sumBase,
    font: { bold: true, sz: 10, color: { rgb: "FF004D40" } },
    alignment: { vertical: "center" },
  });
  merges.push({ s: { r: sumRow, c: COL_NAME }, e: { r: sumRow, c: COL_SCH } });
  for (let di = 0; di < daysInMonth; di++) {
    styleCell(ws, sumRow, COL_DAY + di, sumBase);
  }
  setCell(ws, sumRow, COL_TOT_DAYS, sumDays, {
    ...sumBase,
    font: { bold: true, sz: 12, color: { rgb: "FF004D40" } },
    alignment: { horizontal: "center", vertical: "center" },
  });
  setCell(ws, sumRow, COL_TOT_HOURS, sumHours, {
    ...sumBase,
    font: { bold: true, sz: 12, color: { rgb: "FF004D40" } },
    alignment: { horizontal: "center", vertical: "center" },
  });
  setCell(ws, sumRow, COL_OT, sumOT > 0 ? sumOT : "", {
    ...sumBase,
    font: { bold: sumOT > 0, sz: 12, color: { rgb: sumOT > 0 ? C.OT_FG : "FF9E9E9E" } },
    alignment: { horizontal: "center", vertical: "center" },
  });

  // ─── Легенда ──────────────────────────────────────────────────────────
  // Каждый элемент — одна ячейка: цветной фон + «КОД — Название»
  const legendRow = sumRow + 2;
  setCell(ws, legendRow, COL_N, "Условные обозначения:", {
    font: { bold: true, sz: 9, color: { rgb: "FF37474F" } },
    alignment: { vertical: "center" },
  });
  merges.push({ s: { r: legendRow, c: COL_N }, e: { r: legendRow, c: COL_N + 11 } });

  const legendItems: [string, string, string][] = [
    ["Я",  "#22c55e", "Явка"],
    ["ОТ", "#3b82f6", "Отпуск"],
    ["Б",  "#ef4444", "Больничный"],
    ["К",  "#f59e0b", "Командировка"],
    ["П",  "#dc2626", "Прогул"],
    ["С",  "#a855f7", "Сокращённый"],
  ];
  // Размещаем попарно: код (1 col) + название (3 col), итого 4 col на элемент
  // Первые 3 элемента — строка legendRow+1, столбцы 0..11
  // Последние 3 элемента — строка legendRow+2, столбцы 0..11
  for (let i = 0; i < legendItems.length; i++) {
    const [code, color, label] = legendItems[i];
    const row2 = legendRow + 1 + Math.floor(i / 3);
    const baseCol = (i % 3) * 4;

    // Цветная ячейка с кодом
    setCell(ws, row2, baseCol, code, {
      font: { bold: true, sz: 10, color: { rgb: "FF1A237E" } },
      fill: { fgColor: { rgb: lightenHex(color, 0.35) } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder(C.BORDER),
    });

    // Ячейка с названием (span 3 столбца)
    setCell(ws, row2, baseCol + 1, label, {
      font: { sz: 9, color: { rgb: "FF37474F" } },
      fill: { fgColor: { rgb: lightenHex(color, 0.15) } },
      alignment: { vertical: "center" },
      border: thinBorder(C.BORDER),
    });
    merges.push({ s: { r: row2, c: baseCol + 1 }, e: { r: row2, c: baseCol + 3 } });
  }

  // ─── Размеры столбцов и строк ──────────────────────────────────────────
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 4 },   // №
    { wch: 28 },  // ФИО
    { wch: 7 },   // Таб.№
    { wch: 13 },  // График
    ...days.map(() => ({ wch: 4.2 })),
    { wch: 6 }, { wch: 7 }, { wch: 6 },
  ];
  ws["!rows"] = [
    { hpt: 22 }, // title
    { hpt: 18 }, // org
    { hpt: 16 }, // dept
    { hpt: 14 }, // period
    { hpt: 5  }, // spacer
    { hpt: 18 }, // hdr num
    { hpt: 14 }, // hdr dow
    ...Array.from({ length: data.length * 2 }, (_, i) => ({ hpt: i % 2 === 0 ? 17 : 12 })),
    { hpt: 20 }, // sum row
  ];

  // Заморозка строки заголовков и первых 4 столбцов
  ws["!freeze"] = { xSplit: COL_DAY, ySplit: DATA_START, topLeftCell: `E${DATA_START + 1}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Т-13");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true }) as Buffer;
}

export function generateTimesheetCsv(
  data: TimesheetRow[],
  month: number,
  year: number
): string {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const header = ["ФИО", "Таб.№", "График", ...days.map(String), "Дни", "Часы", "СВ(ч)"];
  const rows = data.map((row) => [
    row.employee.fullName,
    row.employee.personnelNumber,
    row.employee.schedule?.name ?? "8-часовой",
    ...days.map((d) => {
      const primary = row.records[d]?.markCode ?? "";
      const secondary = row.secondaryRecords[d]?.markCode ?? "";
      return secondary ? `${primary}/${secondary}` : primary;
    }),
    String(row.totalDays),
    String(row.totalHours),
    String(row.totalOvertimeHours || ""),
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
