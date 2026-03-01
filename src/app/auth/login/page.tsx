"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DEMO_ACCOUNTS = [
  { label: "Соколов Дмитрий (Администратор)",    email: "sokolov.dmitry@tantk.ru",  password: "Beriev@2026",  color: "bg-red-500",    role: "ADMIN" },
  { label: "Васильев Олег (Менеджер отдела №1)",   email: "vasiliev.oleg@tantk.ru",   password: "Ceh1Master!",  color: "bg-blue-500",   role: "MANAGER" },
  { label: "Захаров Роман (Менеджер отдела №2)",   email: "zaharov.roman@tantk.ru",   password: "Ceh2Master!",  color: "bg-blue-400",   role: "MANAGER" },
  { label: "Фёдоров Михаил (Менеджер отдела №3)",  email: "fedorov.mikhail@tantk.ru", password: "Ceh3Master!",  color: "bg-blue-300",   role: "MANAGER" },
  { label: "Петрова Марина (Бухгалтер)",          email: "petrova.marina@tantk.ru",  password: "Buhgalter1!", color: "bg-green-500",  role: "ACCOUNTANT" },
  { label: "Орлова Наталья (Бухгалтер)",          email: "orlova.natalia@tantk.ru",  password: "Buhgalter2!", color: "bg-green-400",  role: "ACCOUNTANT" },
  { label: "Смирнова Елена (Специалист ОК)",      email: "smirnova.elena@tantk.ru",  password: "HrOtdel2026!", color: "bg-purple-500", role: "HR" },
  { label: "Кузнецова Ирина (Специалист ОК)",     email: "kuznetsova.irina@tantk.ru",password: "HrSpec2026!", color: "bg-purple-400", role: "HR" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      email: loginEmail,
      password: loginPassword,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Неверный email или пароль");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Табель учёта рабочего времени</CardTitle>
            <CardDescription>АО &laquo;ТАНТК им. Г.М. Бериева&raquo;</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@tabel.ru"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Вход..." : "Войти"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Быстрый вход (демо)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <Button
                key={acc.email}
                variant="outline"
                className="w-full justify-start h-9 text-sm"
                onClick={() => doLogin(acc.email, acc.password)}
                disabled={loading}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${acc.color}`} />
                <span className="truncate">{acc.label}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
