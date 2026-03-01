"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  BarChart3,
  Settings,
  ScrollText,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Главная", href: "/", icon: LayoutDashboard },
  { name: "Сотрудники", href: "/employees", icon: Users },
  { name: "Табель", href: "/timesheet", icon: CalendarDays },
  { name: "Отчёты", href: "/reports", icon: BarChart3 },
  { name: "Аудит", href: "/audit", icon: ScrollText, roles: ["ADMIN", "ACCOUNTANT"] },
  { name: "Настройки", href: "/settings", icon: Settings, adminOnly: true },
];

function NavLinks({ pathname, role, onNavigate }: { pathname: string; role: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 p-3">
      {navigation
        .filter((item) => {
          if (item.adminOnly && role !== "ADMIN") return false;
          if (item.roles && !item.roles.includes(role)) return false;
          return true;
        })
        .map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
    </nav>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = ((session?.user as Record<string, unknown>)?.role as string) ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-muted/40">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-5 w-5" />
            <span>Табель</span>
          </Link>
        </div>
        <NavLinks pathname={pathname} role={role} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col bg-background border-r shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <Link
                href="/"
                className="flex items-center gap-2 font-semibold"
                onClick={() => setMobileOpen(false)}
              >
                <CalendarDays className="h-5 w-5" />
                <span>Табель</span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <NavLinks
              pathname={pathname}
              role={role}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Mobile FAB — кнопка меню */}
      <Button
        variant="default"
        size="sm"
        className="md:hidden fixed bottom-4 left-4 z-40 h-12 w-12 rounded-full shadow-lg p-0"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
    </>
  );
}
