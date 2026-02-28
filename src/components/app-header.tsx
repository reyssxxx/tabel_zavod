"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LogOut, ChevronDown, Shield, Wrench, Calculator } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";

const DEMO_ACCOUNTS = [
  {
    email: "admin@tabel.ru",
    password: "admin123",
    label: "Администратор",
    icon: Shield,
    color: "bg-red-500",
  },
  {
    email: "master@tabel.ru",
    password: "master123",
    label: "Мастер Цеха №1",
    icon: Wrench,
    color: "bg-blue-500",
  },
  {
    email: "buh@tabel.ru",
    password: "buh123",
    label: "Бухгалтер",
    icon: Calculator,
    color: "bg-green-500",
  },
];

export function AppHeader() {
  const { data: session } = useSession();
  const user = session?.user as Record<string, unknown> | undefined;
  const role = (user?.role as string) ?? "";
  const name = (user?.name as string) ?? "";

  const handleSwitch = async (email: string, password: string) => {
    await signIn("credentials", { email, password, redirect: false });
    window.location.reload();
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <span className="font-semibold">Табель</span>
      </div>

      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        {/* Переключатель ролей для демо */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <span className="hidden sm:inline">{name}</span>
              <Badge variant="secondary" className="text-xs">
                {ROLE_LABELS[role] ?? role}
              </Badge>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Переключить роль (демо)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {DEMO_ACCOUNTS.map((account) => (
              <DropdownMenuItem
                key={account.email}
                onClick={() => handleSwitch(account.email, account.password)}
                className="gap-2 cursor-pointer"
              >
                <span className={`h-2 w-2 rounded-full ${account.color}`} />
                <account.icon className="h-4 w-4" />
                {account.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Выход</span>
        </Button>
      </div>
    </header>
  );
}
