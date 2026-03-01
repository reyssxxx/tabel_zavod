"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DEFAULT_OT_COEF_1, DEFAULT_OT_COEF_2, DEFAULT_OT_THRESHOLD, DEFAULT_WEEKEND_COEF, DEFAULT_HOLIDAY_COEF } from "@/lib/salary";

const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function WorkHoursSettings() {
  const [otCoef1, setOtCoef1] = useState(DEFAULT_OT_COEF_1);
  const [otCoef2, setOtCoef2] = useState(DEFAULT_OT_COEF_2);
  const [otThreshold, setOtThreshold] = useState(DEFAULT_OT_THRESHOLD);
  const [weekendCoef, setWeekendCoef] = useState(DEFAULT_WEEKEND_COEF);
  const [holidayCoef, setHolidayCoef] = useState(DEFAULT_HOLIDAY_COEF);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/app-settings").then((r) => r.json())
      .then((as) => {
        if (typeof as.otCoef1 === "number") setOtCoef1(as.otCoef1);
        if (typeof as.otCoef2 === "number") setOtCoef2(as.otCoef2);
        if (typeof as.otThreshold === "number") setOtThreshold(as.otThreshold);
        if (typeof as.weekendCoef === "number") setWeekendCoef(as.weekendCoef);
        if (typeof as.holidayCoef === "number") setHolidayCoef(as.holidayCoef);
      })
      .catch(() => toast.error("Ошибка загрузки настроек"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/app-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otCoef1, otCoef2, otThreshold, weekendCoef, holidayCoef }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Ошибка сохранения"); return; }
      toast.success("Коэффициенты сохранены");
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  return (
    <div className="space-y-4">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Сверхурочные коэффициенты</CardTitle>
          <CardDescription>
            По ТК РФ: первые 2 часа — ×1.5, остальные — ×2.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="ot-threshold">Порог (ч)</Label>
              <input id="ot-threshold" type="number" min={0} max={24} step={1}
                value={otThreshold} onChange={(e) => setOtThreshold(Number(e.target.value))}
                className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ot-coef1">Коэф. 1 (до порога)</Label>
              <input id="ot-coef1" type="number" min={1} max={10} step={0.1}
                value={otCoef1} onChange={(e) => setOtCoef1(Number(e.target.value))}
                className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ot-coef2">Коэф. 2 (сверх порога)</Label>
              <input id="ot-coef2" type="number" min={1} max={10} step={0.1}
                value={otCoef2} onChange={(e) => setOtCoef2(Number(e.target.value))}
                className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Первые {otThreshold} ч СВ × {otCoef1}, остальные × {otCoef2}
          </p>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Выходные и праздники</CardTitle>
          <CardDescription>
            Коэффициент оплаты за работу в выходной или нерабочий праздничный день. По ТК РФ — не менее ×2.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="weekend-coef">Выходные (сб/вс)</Label>
              <input id="weekend-coef" type="number" min={1} max={10} step={0.1}
                value={weekendCoef} onChange={(e) => setWeekendCoef(Number(e.target.value))}
                className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-coef">Праздничные дни</Label>
              <input id="holiday-coef" type="number" min={1} max={10} step={0.1}
                value={holidayCoef} onChange={(e) => setHolidayCoef(Number(e.target.value))}
                className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Пример: при коэф. {weekendCoef} — за 8 ч в выходной будет начислено {weekendCoef}× почасовой ставки
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Сохранение..." : "Сохранить все коэффициенты"}
      </Button>
    </div>
  );
}
