"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { PositionOption } from "@/types";

export function PositionSettings() {
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<PositionOption | null>(null);
  const [inputName, setInputName] = useState("");
  const [inputSalary, setInputSalary] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchPositions() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/positions");
      setPositions(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPositions(); }, []);

  function openAdd() {
    setEditTarget(null);
    setInputName("");
    setInputSalary("");
    setShowDialog(true);
  }

  function openEdit(pos: PositionOption) {
    setEditTarget(pos);
    setInputName(pos.name);
    setInputSalary(String(pos.baseSalary));
    setShowDialog(true);
  }

  async function handleSave() {
    const name = inputName.trim();
    const baseSalary = parseFloat(inputSalary);
    if (!name) { toast.error("Введите название должности"); return; }
    if (!isFinite(baseSalary) || baseSalary < 0) { toast.error("Введите корректный оклад"); return; }

    setSaving(true);
    try {
      const res = await fetch(
        editTarget ? `/api/settings/positions/${editTarget.id}` : "/api/settings/positions",
        {
          method: editTarget ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, baseSalary }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Ошибка сохранения");
        return;
      }
      toast.success(editTarget ? "Должность обновлена" : "Должность добавлена");
      setShowDialog(false);
      fetchPositions();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pos: PositionOption) {
    if (!confirm(`Удалить должность "${pos.name}"?`)) return;
    const res = await fetch(`/api/settings/positions/${pos.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Ошибка удаления");
      return;
    }
    toast.success("Должность удалена");
    fetchPositions();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Должности и оклады</CardTitle>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Добавить</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Загрузка...</p>
        ) : positions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Должности не добавлены</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold">Название</th>
                <th className="text-right py-2 font-semibold pr-4">Оклад (руб.)</th>
                <th className="text-center py-2 font-semibold">Сотрудников</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2">{pos.name}</td>
                  <td className="py-2 pr-4 text-right font-mono">
                    {pos.baseSalary.toLocaleString("ru-RU")}
                  </td>
                  <td className="py-2 text-center text-muted-foreground">{pos.employeeCount ?? 0}</td>
                  <td className="py-2 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(pos)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(pos)}
                      disabled={(pos.employeeCount ?? 0) > 0}
                      title={(pos.employeeCount ?? 0) > 0 ? "Есть привязанные сотрудники" : undefined}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "Редактировать должность" : "Добавить должность"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Название</label>
              <Input
                placeholder="Инженер 1 категории"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Оклад (руб./месяц)</label>
              <Input
                type="number"
                min={0}
                step={1000}
                placeholder="80000"
                value={inputSalary}
                onChange={(e) => setInputSalary(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
