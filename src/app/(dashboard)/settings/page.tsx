"use client";

import { useSession } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepartmentSettings } from "@/components/settings/department-settings";
import { HolidaySettings } from "@/components/settings/holiday-settings";
import { WorkHoursSettings } from "@/components/settings/work-hours-settings";
import { ScheduleSettings } from "@/components/settings/schedule-settings";
import { PositionSettings } from "@/components/settings/position-settings";
import { UserSettings } from "@/components/settings/user-settings";
import { Card, CardContent } from "@/components/ui/card";
import type { SessionUser } from "@/types";

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;

  if (user && user.role !== "ADMIN") {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Доступ только для администраторов
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Настройки</h1>
      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Подразделения</TabsTrigger>
          <TabsTrigger value="positions">Должности</TabsTrigger>
          <TabsTrigger value="holidays">Праздники</TabsTrigger>
          <TabsTrigger value="schedules">Графики работы</TabsTrigger>
          <TabsTrigger value="work-hours">Параметры</TabsTrigger>
          <TabsTrigger value="users">Пользователи</TabsTrigger>
        </TabsList>
        <TabsContent value="departments" className="mt-4">
          <DepartmentSettings />
        </TabsContent>
        <TabsContent value="holidays" className="mt-4">
          <HolidaySettings />
        </TabsContent>
        <TabsContent value="schedules" className="mt-4">
          <ScheduleSettings />
        </TabsContent>
        <TabsContent value="positions" className="mt-4">
          <PositionSettings />
        </TabsContent>
        <TabsContent value="work-hours" className="mt-4">
          <WorkHoursSettings />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UserSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
