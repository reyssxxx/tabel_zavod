"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/constants";
import type { SessionUser } from "@/types";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId: string | null;
  departmentName: string | null;
}

interface Department {
  id: string;
  name: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700 border-red-200",
  MANAGER: "bg-blue-100 text-blue-700 border-blue-200",
  ACCOUNTANT: "bg-green-100 text-green-700 border-green-200",
  HR: "bg-purple-100 text-purple-700 border-purple-200",
};

const ROLES_NEED_DEPT = ["MANAGER"];

export function UserSettings() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as SessionUser | undefined)?.id;

  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fName, setFName] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fRole, setFRole] = useState("MANAGER");
  const [fDeptId, setFDeptId] = useState<string>("");
  const [fPassword, setFPassword] = useState("");

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  function openAdd() {
    setEditTarget(null);
    setFName("");
    setFEmail("");
    setFRole("MANAGER");
    setFDeptId("");
    setFPassword("");
    setShowDialog(true);
  }

  function openEdit(user: UserRow) {
    setEditTarget(user);
    setFName(user.name);
    setFEmail(user.email);
    setFRole(user.role);
    setFDeptId(user.departmentId ?? "");
    setFPassword("");
    setShowDialog(true);
  }

  async function handleSave() {
    if (!fName.trim() || (!editTarget && !fPassword.trim())) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: fName.trim(),
        role: fRole,
        departmentId: fDeptId || null,
      };
      if (!editTarget) {
        body.email = fEmail.trim().toLowerCase();
        body.password = fPassword.trim();
      } else {
        if (fPassword.trim()) body.password = fPassword.trim();
      }

      const res = editTarget
        ? await fetch(`/api/settings/users/${editTarget.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/settings/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка сохранения");
        return;
      }
      toast.success(editTarget ? "Пользователь обновлён" : "Пользователь создан");
      setShowDialog(false);
      fetchUsers();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: UserRow) {
    if (!confirm(`Удалить пользователя "${user.name}" (${user.email})?`)) return;
    try {
      const res = await fetch(`/api/settings/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка удаления");
        return;
      }
      toast.success("Пользователь удалён");
      fetchUsers();
    } catch {
      toast.error("Ошибка удаления");
    }
  }

  const isSelf = (id: string) => id === currentUserId;
  const needsDept = ROLES_NEED_DEPT.includes(fRole);
  const canSave = fName.trim() && fRole &&
    (!editTarget ? (fEmail.trim() && fPassword.trim()) : true);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Управление учётными записями пользователей системы
        </p>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить пользователя
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-40">Роль</TableHead>
              <TableHead>Подразделение</TableHead>
              <TableHead className="w-28">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Нет пользователей
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className={isSelf(user.id) ? "bg-muted/30" : ""}>
                  <TableCell className="font-medium">
                    {user.name}
                    {isSelf(user.id) && (
                      <span className="ml-2 text-xs text-muted-foreground">(вы)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] ?? ""}`}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.departmentName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title="Редактировать">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isSelf(user.id)}
                        title={isSelf(user.id) ? "Нельзя удалить себя" : "Удалить"}
                        onClick={() => handleDelete(user)}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Редактировать пользователя" : "Добавить пользователя"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Имя *</label>
              <Input
                placeholder="Иванов Иван Иванович"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
              />
            </div>

            {!editTarget && (
              <div>
                <label className="text-sm font-medium mb-1 block">Email *</label>
                <Input
                  type="email"
                  placeholder="user@company.ru"
                  value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">Роль *</label>
              <Select
                value={fRole}
                onValueChange={(v) => { setFRole(v); if (!ROLES_NEED_DEPT.includes(v)) setFDeptId(""); }}
                disabled={editTarget ? isSelf(editTarget.id) : false}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <SelectItem key={role} value={role}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editTarget && isSelf(editTarget.id) && (
                <p className="text-xs text-muted-foreground mt-1">Нельзя изменить роль своей учётной записи</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Подразделение {needsDept ? "*" : "(необязательно)"}
              </label>
              <Select
                value={fDeptId || "none"}
                onValueChange={(v) => setFDeptId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Не выбрано" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Не выбрано —</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                <span className="flex items-center gap-1">
                  <KeyRound className="h-3.5 w-3.5" />
                  {editTarget ? "Новый пароль (оставить пустым — не менять)" : "Пароль *"}
                </span>
              </label>
              <Input
                type="password"
                placeholder={editTarget ? "Новый пароль..." : "Пароль"}
                value={fPassword}
                onChange={(e) => setFPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
