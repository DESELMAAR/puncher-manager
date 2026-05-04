"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  DepartmentDto,
  NotificationDto,
  PunchDto,
  TeamDto,
  WeeklyScheduleResponse,
} from "@/lib/types";
import { ActiveStatusTimer } from "@/components/punch/ActiveStatusTimer";
import { DashboardWeeklySchedule } from "@/components/schedule/DashboardWeeklySchedule";
import { ScheduleConfirmModal } from "@/components/schedule/ScheduleConfirmModal";
import { extractApiMessage } from "@/lib/errors";
import { toast } from "sonner";
import { localDateISO } from "@/lib/dateUtils";

export default function DashboardPage() {
  const { name, role, employeeId, teamId, departmentId } = useAuthStore();
  const [punches, setPunches] = useState<PunchDto[]>([]);
  const [deptName, setDeptName] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleNotification, setScheduleNotification] = useState<NotificationDto | null>(null);
  const [schedulePayload, setSchedulePayload] = useState<WeeklyScheduleResponse | null>(null);

  const refresh = useCallback(async (silent?: boolean) => {
    const day = localDateISO();
    const { data } = await api.get<PunchDto[]>("/api/punch/my-history", {
      params: { from: day, to: day },
      skipGlobalLoading: silent,
    });
    setPunches(data);
  }, []);

  useEffect(() => {
    if (role !== "EMPLOYEE") return;
    void refresh();
    const id = setInterval(() => void refresh(true), 15_000);
    return () => clearInterval(id);
  }, [role, refresh]);

  const checkScheduleNotifications = useCallback(async (silent?: boolean) => {
    if (role !== "EMPLOYEE") return;
    try {
      const { data } = await api.get<NotificationDto[]>("/api/notification/my", {
        skipGlobalLoading: silent,
      });
      const first = data.find((n) => !n.read && n.type === "SCHEDULE_CONFIRM" && n.payloadJson);
      if (!first) return;
      const payload = JSON.parse(first.payloadJson as string) as WeeklyScheduleResponse;
      if (!payload?.scheduleId) return;
      setScheduleNotification(first);
      setSchedulePayload(payload);
      setScheduleModalOpen(true);
    } catch (e) {
      toast.error(extractApiMessage(e));
    }
  }, [role]);

  useEffect(() => {
    void checkScheduleNotifications();
    const id = setInterval(() => void checkScheduleNotifications(true), 30_000);
    return () => clearInterval(id);
  }, [checkScheduleNotifications]);

  useEffect(() => {
    if (role !== "EMPLOYEE") return;
    void (async () => {
      try {
        const { data: deps } = await api.get<DepartmentDto[]>("/api/departments");
        const dept = departmentId ? deps.find((d) => d.id === departmentId) : null;
        setDeptName(dept?.name ?? null);
        if (teamId) {
          const { data: t } = await api.get<TeamDto>("/api/teams/my");
          setTeamName(t?.name ?? null);
        } else {
          setTeamName(null);
        }
      } catch {
        setDeptName(null);
        setTeamName(null);
      }
    })();
  }, [role, departmentId, teamId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Welcome, {name}. You are signed in as <strong>{role}</strong>.
      </p>
      {role === "EMPLOYEE" && <ActiveStatusTimer punches={punches} />}
      {scheduleModalOpen && scheduleNotification && schedulePayload && (
        <ScheduleConfirmModal
          open={scheduleModalOpen}
          notificationId={scheduleNotification.id}
          schedule={schedulePayload}
          onClose={() => setScheduleModalOpen(false)}
          onConfirmed={() => {
            setScheduleNotification(null);
            setSchedulePayload(null);
          }}
        />
      )}
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <dt className="text-xs uppercase text-zinc-500">Employee ID</dt>
          <dd className="font-mono text-lg">{employeeId}</dd>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <dt className="text-xs uppercase text-zinc-500">Department / Team</dt>
          <dd className="text-sm">
            {deptName ?? "—"}
            {" · "}
            {teamName ?? "—"}
          </dd>
        </div>
      </dl>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {role === "EMPLOYEE" && (
            <>
              <Link
                href="/punch"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                Go to Punch
              </Link>
              <Link href="/history" className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600">
                Punch history
              </Link>
            </>
          )}
          {(role === "TEAM_LEADER" || role === "DEPT_MANAGER" || role === "SUPER_ADMIN" || role === "ADMIN") && (
            <Link href="/team" className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">
              Team attendance
            </Link>
          )}
          {role === "SUPER_ADMIN" && (
            <Link href="/admin/settings" className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600">
              Settings
            </Link>
          )}
          <Link href="/notifications" className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600">
            Notifications
          </Link>
        </div>
        {role === "EMPLOYEE" && <DashboardWeeklySchedule />}
      </div>
    </div>
  );
}
