"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, CheckCircle, XCircle } from "lucide-react";

interface CsvRow {
  fio: string;
  position: string;
  department: string;
  personnelNumber: string;
}

interface ImportResult {
  imported: number;
  errors: string[];
}

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function parseCSV(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const delimiter =
    headerLine.split(";").length >= headerLine.split(",").length ? ";" : ",";

  const headers = headerLine
    .split(delimiter)
    .map((h) => h.trim().replace(/^["']|["']$/g, "").toLowerCase());

  const colFio = headers.findIndex(
    (h) => h.includes("фио") || h.includes("ф.и.о")
  );
  const colPos = headers.findIndex((h) => h.includes("должност"));
  const colDept = headers.findIndex(
    (h) => h.includes("подразделен") || h.includes("цех") || h.includes("отдел")
  );
  const colNum = headers.findIndex((h) => h.includes("табельн"));

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]
      .split(delimiter)
      .map((c) => c.trim().replace(/^["']|["']$/g, ""));
    rows.push({
      fio: colFio >= 0 ? (cols[colFio] ?? "") : "",
      position: colPos >= 0 ? (cols[colPos] ?? "") : "",
      department: colDept >= 0 ? (cols[colDept] ?? "") : "",
      personnelNumber: colNum >= 0 ? (cols[colNum] ?? "") : "",
    });
  }
  return rows;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: CsvImportDialogProps) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = (val: boolean) => {
    if (!val) {
      setStep("upload");
      setPreview([]);
      setFile(null);
      setResult(null);
    }
    onOpenChange(val);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast.error("Не удалось распознать данные в CSV файле");
        return;
      }
      setPreview(rows);
      setStep("preview");
    };
    reader.readAsText(f, "UTF-8");
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/employees/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Ошибка импорта");
        return;
      }

      setResult(data as ImportResult);
      setStep("result");

      if ((data as ImportResult).imported > 0) {
        onSuccess();
      }
    } catch {
      toast.error("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Импорт сотрудников из CSV</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Загрузите CSV файл с колонками: <strong>ФИО, Должность, Подразделение, Табельный номер</strong>.
              Разделитель — запятая или точка с запятой. Кодировка — UTF-8.
            </p>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Нажмите для выбора файла или перетащите его сюда
              </p>
              <p className="text-xs text-muted-foreground mt-1">.csv</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Отмена
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Найдено строк: <strong>{preview.length}</strong>. Показаны первые 10.
            </p>
            <div className="max-h-72 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Должность</TableHead>
                    <TableHead>Подразделение</TableHead>
                    <TableHead>Таб. №</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.fio || <span className="text-destructive">—</span>}</TableCell>
                      <TableCell>{row.position || <span className="text-destructive">—</span>}</TableCell>
                      <TableCell>{row.department || <span className="text-destructive">—</span>}</TableCell>
                      <TableCell>{row.personnelNumber || <span className="text-destructive">—</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setPreview([]);
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                disabled={loading}
              >
                Назад
              </Button>
              <Button onClick={handleImport} disabled={loading}>
                {loading ? "Импортирование..." : `Импортировать ${preview.length} записей`}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">
                Импортировано: {result.imported} сотрудников
              </span>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Ошибки ({result.errors.length}):</span>
                </div>
                <div className="max-h-48 overflow-auto rounded border p-2 space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-sm text-destructive">
                      {err}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => handleClose(false)}>Закрыть</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
