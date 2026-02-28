"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { WorkScheduleOption } from "@/types";

export function ScheduleSettings() {
  const [schedules, setSchedules] = useState<WorkScheduleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkScheduleOption | null>(null);
  const [inputName, setInputName] = useState("");
  const [inputHours, setInputHours] = useState<number>(8);
  const [saving, setSaving] = useState(false);

  async function fetchSchedules() {
    try {
      const res = await fetch("/api/settings/schedules");
      const data = await res.json();
      setSchedules(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSchedules();
  }, []);

  function openCreate() {
    setEditTarget(null);
    setInputName("");
    setInputHours(8);
    setShowDialog(true);
  }

  function openEdit(s: WorkScheduleOption) {
    setEditTarget(s);
    setInputName(s.name);
    setInputHours(s.hoursPerDay);
    setShowDialog(true);
  }

  async function handleSave() {
    if (!inputName.trim()) return;
    setSaving(true);
    try {
      const url = editTarget
        ? `/api/settings/schedules/${editTarget.id}`
        : "/api/settings/schedules";
      const method = editTarget ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: inputName.trim(), hoursPerDay: inputHours }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Ошибка сохранения");
        return;
      }
      toast.success(editTarget ? "График обновлён" : "График добавлен");
      setShowDialog(false);
      fetchSchedules();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: WorkScheduleOption) {
    if (!confirm(`Удалить график "${s.name}"?`)) return;
    const res = await fetch(`/api/settings/schedules/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Ошибка удаления");
      return;
    }
    toast.success("График удалён");
    fetchSchedules();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Графики работы</CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Добавить
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Загрузка...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Часов в день</TableHead>
                <TableHead className="w-24">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.hoursPerDay}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(s)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {schedules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Нет графиков
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "Редактировать график" : "Добавить график"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Название</label>
              <Input
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Например: 8-часовой"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Часов в рабочем дне</label>
              <Input
                type="number"
                min={1}
                max={24}
                value={inputHours}
                onChange={(e) => setInputHours(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={saving || !inputName.trim()}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
