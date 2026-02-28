"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

interface ExportButtonsProps {
  year: number;
  month: number;
  departmentId: string;
  type: "timesheet" | "report";
}

export function ExportButtons({ year, month, departmentId, type }: ExportButtonsProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function handleDownload(url: string, filename: string, key: string) {
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  const baseParams = `year=${year}&month=${month}&departmentId=${departmentId}`;
  const monthNum = month + 1;

  if (type === "timesheet") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          disabled={loading["xlsx"]}
          onClick={() =>
            handleDownload(
              `/api/export/timesheet?${baseParams}&format=xlsx`,
              `tabel_${monthNum}_${year}.xlsx`,
              "xlsx"
            )
          }
        >
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          {loading["xlsx"] ? "..." : "Excel"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading["csv"]}
          onClick={() =>
            handleDownload(
              `/api/export/timesheet?${baseParams}&format=csv`,
              `tabel_${monthNum}_${year}.csv`,
              "csv"
            )
          }
        >
          <FileText className="h-4 w-4 mr-1" />
          {loading["csv"] ? "..." : "CSV"}
        </Button>
      </>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading["txt"]}
      onClick={() =>
        handleDownload(
          `/api/export/report?${baseParams}`,
          `report_${monthNum}_${year}.txt`,
          "txt"
        )
      }
    >
      <Download className="h-4 w-4 mr-1" />
      {loading["txt"] ? "..." : "TXT"}
    </Button>
  );
}
