"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { NotificationDto, PunchDto, WeeklyScheduleResponse } from "@/lib/types";
import { ActiveStatusTimer } from "@/components/punch/ActiveStatusTimer";
import { ScheduleConfirmModal } from "@/components/schedule/ScheduleConfirmModal";
import { extractApiMessage } from "@/lib/errors";
import { toast } from "sonner";

export default function DashboardPage() {
  const { name, role, employeeId, teamId, departmentId } = useAuthStore();
  const [punches, setPunches] = useState<PunchDto[]>([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleNotification, setScheduleNotification] = useState<NotificationDto | null>(null);
  const [schedulePayload, setSchedulePayload] = useState<WeeklyScheduleResponse | null>(null);

  const refresh = useCallback(async () => {
    const day = new Date().toISOString().slice(0, 10);
    const { data } = await api.get<PunchDto[]>("/api/punch/my-history", {
      params: { from: day, to: day },
    });
    setPunches(data);
  }, []);

  useEffect(() => {
    if (role !== "EMPLOYEE") return;
    void refresh();
    const id = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(id);
  }, [role, refresh]);

  const checkScheduleNotifications = useCallback(async () => {
    if (role !== "EMPLOYEE") return;
    try {
      const { data } = await api.get<NotificationDto[]>("/api/notification/my");
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
    const id = setInterval(() => void checkScheduleNotifications(), 30_000);
    return () => clearInterval(id);
  }, [checkScheduleNotifications]);

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
            {departmentId ? <span className="font-mono">{departmentId.slice(0, 8)}…</span> : "—"}
            {" · "}
            {teamId ? <span className="font-mono">{teamId.slice(0, 8)}…</span> : "—"}
          </dd>
        </div>
      </dl>
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
        <Link href="/notifications" className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600">
          Notifications
        </Link>
      </div>
    </div>
  );
}
