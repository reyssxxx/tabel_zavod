"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DepartmentWithCount } from "@/types";

export function DepartmentSettings() {
  const [departments, setDepartments] = useState<DepartmentWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<DepartmentWithCount | null>(null);
  const [inputName, setInputName] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchDepartments() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/departments");
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Ошибка загрузки подразделений");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDepartments();
  }, []);

  function openAdd() {
    setEditTarget(null);
    setInputName("");
    setShowDialog(true);
  }

  function openEdit(dept: DepartmentWithCount) {
    setEditTarget(dept);
    setInputName(dept.name);
    setShowDialog(true);
  }

  async function handleSave() {
    if (!inputName.trim()) return;
    setSaving(true);
    try {
      const res = editTarget
        ? await fetch(`/api/settings/departments/${editTarget.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: inputName.trim() }),
          })
        : await fetch("/api/settings/departments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: inputName.trim() }),
          });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка сохранения");
        return;
      }
      toast.success(editTarget ? "Подразделение обновлено" : "Подразделение добавлено");
      setShowDialog(false);
      fetchDepartments();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(dept: DepartmentWithCount) {
    if (!confirm(`Удалить подразделение "${dept.name}"?`)) return;
    try {
      const res = await fetch(`/api/settings/departments/${dept.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка удаления");
        return;
      }
      toast.success("Подразделение удалено");
      fetchDepartments();
    } catch {
      toast.error("Ошибка удаления");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Управление структурными подразделениями предприятия
        </p>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить подразделение
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead className="w-48">Активных сотрудников</TableHead>
              <TableHead className="w-24">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Нет подразделений
                </TableCell>
              </TableRow>
            ) : (
              departments.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell>{dept.employeeCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={dept.employeeCount > 0}
                        title={dept.employeeCount > 0 ? "Есть активные сотрудники" : undefined}
                        onClick={() => handleDelete(dept)}
                      >
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
              {editTarget ? "Редактировать подразделение" : "Добавить подразделение"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Название подразделения"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !inputName.trim()}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
