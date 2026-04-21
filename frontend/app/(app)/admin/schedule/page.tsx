"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { extractApiMessage } from "@/lib/errors";
import type {
  UserDto,
  UserRole,
  WeeklyScheduleDayDto,
  WeeklyScheduleResponse,
} from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { localDateISO, normalizeWeekStartSunday } from "@/lib/dateUtils";

const DOW_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toTimeHHmmss(v: string) {
  if (!v) return null;
  return v.length === 5 ? `${v}:00` : v;
}

function fromTimeHHmmss(v: string | null) {
  if (!v) return "";
  return v.slice(0, 5);
}

function defaultWeek(): WeeklyScheduleDayDto[] {
  return [
    { dayOfWeek: 0, dayOff: true, startTime: null, endTime: null },
    { dayOfWeek: 1, dayOff: false, startTime: "09:00:00", endTime: "17:00:00" },
    { dayOfWeek: 2, dayOff: false, startTime: "09:00:00", endTime: "17:00:00" },
    { dayOfWeek: 3, dayOff: false, startTime: "09:00:00", endTime: "17:00:00" },
    { dayOfWeek: 4, dayOff: false, startTime: "09:00:00", endTime: "17:00:00" },
    { dayOfWeek: 5, dayOff: false, startTime: "09:00:00", endTime: "17:00:00" },
    { dayOfWeek: 6, dayOff: true, startTime: null, endTime: null },
  ];
}

export default function WeeklyScheduleAdminPage() {
  const role = useAuthStore((s) => s.role) as UserRole;
  const authTeamId = useAuthStore((s) => s.teamId);

  const allowed =
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "DEPT_MANAGER" ||
    role === "TEAM_LEADER";

  const [users, setUsers] = useState<UserDto[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<string>(normalizeWeekStartSunday(localDateISO()));
  const [loading, setLoading] = useState(true);

  const [schedule, setSchedule] = useState<WeeklyScheduleResponse | null>(null);
  const [days, setDays] = useState<WeeklyScheduleDayDto[]>(defaultWeek());
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const employees = useMemo(() => {
    return users.filter((u) => u.role === "EMPLOYEE");
  }, [users]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<UserDto[]>("/api/users");
      setUsers(data);
      setSelectedEmployeeId((prev) => prev || data.find((u) => u.role === "EMPLOYEE")?.id || "");
    } catch (e) {
      toast.error(extractApiMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    if (!selectedEmployeeId || !weekStart) {
      setSchedule(null);
      setDays(defaultWeek());
      return;
    }
    try {
      const { data } = await api.get<WeeklyScheduleResponse>("/api/schedules/week", {
        params: { employeeId: selectedEmployeeId, weekStart },
      });
      setSchedule(data);
      setDays(data.days?.length === 7 ? data.days : defaultWeek());
    } catch (e) {
      toast.error(extractApiMessage(e));
      setSchedule(null);
      setDays(defaultWeek());
    }
  }, [selectedEmployeeId, weekStart]);

  useEffect(() => {
    if (!allowed) return;
    void loadUsers();
  }, [allowed, loadUsers]);

  useEffect(() => {
    if (!allowed) return;
    void loadSchedule();
  }, [allowed, loadSchedule]);

  async function save() {
    if (!selectedEmployeeId) return;
    setSaving(true);
    try {
      const { data } = await api.put<WeeklyScheduleResponse>("/api/schedules/week", {
        employeeId: selectedEmployeeId,
        weekStart,
        days,
      });
      setSchedule(data);
      setDays(data.days);
      toast.success("Schedule saved");
    } catch (e) {
      toast.error(extractApiMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function sendConfirmation() {
    if (!schedule?.scheduleId) return;
    setSending(true);
    try {
      const { data } = await api.post<WeeklyScheduleResponse>(
        `/api/schedules/${schedule.scheduleId}/send-confirmation`,
      );
      setSchedule(data);
      toast.success("Confirmation sent to employee");
    } catch (e) {
      toast.error(extractApiMessage(e));
    } finally {
      setSending(false);
    }
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="font-medium">You do not have permission to manage schedules.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Weekly schedule</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
            Set a weekly work plan (Sunday → Saturday) for employees in your scope. Save then send a
            confirmation request; employees can confirm or ask for correction.
          </p>
          {role === "TEAM_LEADER" && authTeamId && (
            <p className="mt-2 text-xs text-zinc-500">
              Team leader scope: employees on your team only.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={!selectedEmployeeId || saving}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => void sendConfirmation()}
            disabled={!schedule?.scheduleId || sending}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send confirmation"}
          </button>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <label className="block text-sm font-medium">
                Week (snaps to Sunday)
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  value={weekStart}
                  onChange={(e) => setWeekStart(normalizeWeekStartSunday(e.target.value))}
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Employee
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {employees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {schedule && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Confirmation</div>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs dark:bg-zinc-800">
                    {schedule.confirmationStatus}
                  </span>
                </div>
                {schedule.respondedAt && (
                  <div className="mt-2 text-xs text-zinc-500">
                    Responded at {new Date(schedule.respondedAt).toLocaleString()}
                  </div>
                )}
                {schedule.confirmationComment && (
                  <div className="mt-2 rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    {schedule.confirmationComment}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Day</th>
                    <th className="px-4 py-3 font-semibold">Day off</th>
                    <th className="px-4 py-3 font-semibold">Start</th>
                    <th className="px-4 py-3 font-semibold">End</th>
                  </tr>
                </thead>
                <tbody>
                  {days
                    .slice()
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                    .map((d) => (
                      <tr key={d.dayOfWeek} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="px-4 py-3 font-medium">{DOW_LABELS[d.dayOfWeek]}</td>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={d.dayOff}
                            onChange={(e) =>
                              setDays((prev) =>
                                prev.map((x) =>
                                  x.dayOfWeek !== d.dayOfWeek
                                    ? x
                                    : {
                                        ...x,
                                        dayOff: e.target.checked,
                                        startTime: e.target.checked ? null : x.startTime || "09:00:00",
                                        endTime: e.target.checked ? null : x.endTime || "17:00:00",
                                      },
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="time"
                            className="w-32 rounded-lg border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                            disabled={d.dayOff}
                            value={fromTimeHHmmss(d.startTime)}
                            onChange={(e) => {
                              const v = toTimeHHmmss(e.target.value);
                              setDays((prev) =>
                                prev.map((x) =>
                                  x.dayOfWeek !== d.dayOfWeek ? x : { ...x, startTime: v },
                                ),
                              );
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="time"
                            className="w-32 rounded-lg border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                            disabled={d.dayOff}
                            value={fromTimeHHmmss(d.endTime)}
                            onChange={(e) => {
                              const v = toTimeHHmmss(e.target.value);
                              setDays((prev) =>
                                prev.map((x) =>
                                  x.dayOfWeek !== d.dayOfWeek ? x : { ...x, endTime: v },
                                ),
                              );
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Tip: Save first to create the schedule, then send confirmation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

