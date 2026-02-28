"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import type { HolidayRecord } from "@/types";

interface HolidayForm {
  date: string;
  name: string;
  isShortened: boolean;
}

const emptyForm: HolidayForm = { date: "", name: "", isShortened: false };

export function HolidaySettings() {
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<HolidayRecord | null>(null);
  const [form, setForm] = useState<HolidayForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function fetchHolidays() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/holidays");
      const data = await res.json();
      setHolidays(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Ошибка загрузки праздников");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHolidays();
  }, []);

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(holiday: HolidayRecord) {
    setEditTarget(holiday);
    setForm({ date: holiday.date, name: holiday.name, isShortened: holiday.isShortened });
    setShowDialog(true);
  }

  async function handleSave() {
    if (!form.date || !form.name.trim()) return;
    setSaving(true);
    try {
      const res = editTarget
        ? await fetch(`/api/settings/holidays/${editTarget.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, name: form.name.trim() }),
          })
        : await fetch("/api/settings/holidays", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, name: form.name.trim() }),
          });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка сохранения");
        return;
      }
      toast.success(editTarget ? "Праздник обновлён" : "Праздник добавлен");
      setShowDialog(false);
      fetchHolidays();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(holiday: HolidayRecord) {
    if (!confirm(`Удалить "${holiday.name}"?`)) return;
    try {
      const res = await fetch(`/api/settings/holidays/${holiday.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка удаления");
        return;
      }
      toast.success("Праздник удалён");
      fetchHolidays();
    } catch {
      toast.error("Ошибка удаления");
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("ru-RU");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Праздничные и сокращённые рабочие дни отображаются в табеле
        </p>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить праздник
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Дата</TableHead>
              <TableHead>Название</TableHead>
              <TableHead className="w-40">Тип</TableHead>
              <TableHead className="w-24">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Нет праздников
                </TableCell>
              </TableRow>
            ) : (
              holidays.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{formatDate(h.date)}</TableCell>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>
                    {h.isShortened ? (
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100">
                        Сокращённый
                      </Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-100">
                        Праздник
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(h)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(h)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Редактировать праздник" : "Добавить праздник"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="holiday-date">Дата</Label>
              <input
                id="holiday-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Название</Label>
              <Input
                id="holiday-name"
                placeholder="Например: День Победы"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="holiday-shortened"
                type="checkbox"
                checked={form.isShortened}
                onChange={(e) => setForm((f) => ({ ...f, isShortened: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="holiday-shortened" className="cursor-pointer">
                Сокращённый рабочий день
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.date || !form.name.trim()}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
