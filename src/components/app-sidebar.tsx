"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Главная", href: "/", icon: LayoutDashboard },
  { name: "Сотрудники", href: "/employees", icon: Users },
  { name: "Табель", href: "/timesheet", icon: CalendarDays },
  { name: "Отчёты", href: "/reports", icon: BarChart3 },
  { name: "Настройки", href: "/settings", icon: Settings, adminOnly: true },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as Record<string, unknown>)?.role as string;

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-muted/40">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <CalendarDays className="h-5 w-5" />
          <span>Табель</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navigation
          .filter((item) => !item.adminOnly || role === "ADMIN")
          .map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
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
    </aside>
  );
}
