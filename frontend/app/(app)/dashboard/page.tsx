"use client";

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
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export default function DashboardPage() {
  const { name, email, role, employeeId, teamId, departmentId } = useAuthStore();
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
    if (role !== "EMPLOYEE" && role !== "DEPT_MANAGER") return;
    void (async () => {
      try {
        const { data: deps } = await api.get<DepartmentDto[]>("/api/departments");
        const dept = departmentId ? deps.find((d) => d.id === departmentId) : null;
        setDeptName(dept?.name ?? null);
        if (role === "EMPLOYEE" && teamId) {
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
      <PageHeader
        title="Dashboard"
        description={
          name
            ? `Welcome back, ${name}. You are signed in as ${role?.replace(/_/g, " ") ?? "user"}.`
            : undefined
        }
      />

      {role === "DEPT_MANAGER" && (
        <Card className="border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-slate-900 dark:border-emerald-900/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-emerald-900 dark:text-emerald-100">Department manager</div>
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{deptName ?? "—"}</span>
          </div>
          <div className="mt-2 text-sm text-emerald-900/90 dark:text-emerald-100/90">
            <span className="font-medium">{name ?? "—"}</span>
            {employeeId ? <span className="font-mono text-xs"> · {employeeId}</span> : null}
            {email ? <span className="block text-xs text-[var(--pm-muted)]">{email}</span> : null}
          </div>
        </Card>
      )}

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
        <Card>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--pm-muted)]">Employee ID</dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-slate-50">{employeeId}</dd>
        </Card>
        <Card>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--pm-muted)]">Department / Team</dt>
          <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
            {deptName ?? "—"}
            <span className="text-[var(--pm-muted)]"> · </span>
            {teamName ?? "—"}
          </dd>
        </Card>
      </dl>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {role === "EMPLOYEE" && (
            <>
              <ButtonLink href="/punch">Go to Punch</ButtonLink>
              <ButtonLink href="/history" variant="secondary">
                Punch history
              </ButtonLink>
            </>
          )}
          {(role === "TEAM_LEADER" || role === "DEPT_MANAGER" || role === "SUPER_ADMIN" || role === "ADMIN") && (
            <ButtonLink href="/team">Team attendance</ButtonLink>
          )}
          {role === "SUPER_ADMIN" && (
            <ButtonLink href="/admin/settings" variant="secondary">
              Settings
            </ButtonLink>
          )}
          <ButtonLink href="/notifications" variant="secondary">
            Notifications
          </ButtonLink>
        </div>
        {role === "EMPLOYEE" && (
          <div className="mt-6 border-t border-[var(--pm-border)] pt-6">
            <DashboardWeeklySchedule />
          </div>
        )}
      </Card>
    </div>
  );
}
