"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  DepartmentDto,
  NotificationDto,
  TeamDto,
  UserDto,
  WeeklyScheduleResponse,
} from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { ScheduleConfirmModal } from "@/components/schedule/ScheduleConfirmModal";

type TargetType = "ALL_EMPLOYEES" | "DEPARTMENT" | "TEAM" | "EMPLOYEE";

export default function NotificationsPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const teamId = useAuthStore((s) => s.teamId);
  const departmentId = useAuthStore((s) => s.departmentId);
  const [sendText, setSendText] = useState("");
  const [sendOk, setSendOk] = useState<string | null>(null);
  const baseURL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleNotificationId, setScheduleNotificationId] = useState<string | null>(null);
  const [schedulePayload, setSchedulePayload] = useState<WeeklyScheduleResponse | null>(null);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [targetType, setTargetType] = useState<TargetType>("TEAM");
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [employees, setEmployees] = useState<UserDto[]>([]);
  const [selectedEmployeeUserId, setSelectedEmployeeUserId] = useState<string>("");

  const unreadScheduleConfirm = useMemo(() => {
    return items.find((n) => !n.read && n.type === "SCHEDULE_CONFIRM" && n.payloadJson);
  }, [items]);

  async function load() {
    const { data } = await api.get<NotificationDto[]>("/api/notification/my");
    setItems(data);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    // SUPER_ADMIN / ADMIN can target across the org; load lists once.
    const isSuper = role === "SUPER_ADMIN" || role === "ADMIN";
    if (!isSuper) return;
    void (async () => {
      try {
        const [dRes, uRes] = await Promise.all([
          api.get<DepartmentDto[]>("/api/departments"),
          api.get<UserDto[]>("/api/users"),
        ]);
        setDepartments(dRes.data);
        setEmployees(uRes.data.filter((u) => u.role === "EMPLOYEE"));
      } catch {
        setDepartments([]);
        setEmployees([]);
      }
    })();
  }, [role]);

  useEffect(() => {
    // Load team choices depending on role scope.
    const canBroadcast =
      role === "SUPER_ADMIN" || role === "ADMIN" || role === "DEPT_MANAGER" || role === "TEAM_LEADER";
    if (!canBroadcast) return;
    if (role === "TEAM_LEADER") {
      setTeams([]);
      setSelectedTeamId(teamId ?? "");
      return;
    }
    if (role === "DEPT_MANAGER") {
      if (!departmentId) {
        setTeams([]);
        setSelectedTeamId("");
        return;
      }
      void (async () => {
        try {
          const { data } = await api.get<TeamDto[]>(`/api/teams/department/${departmentId}`);
          setTeams(data);
          setSelectedTeamId(data[0]?.id ?? "");
        } catch {
          setTeams([]);
          setSelectedTeamId("");
        }
      })();
      return;
    }
    // SUPER_ADMIN / ADMIN: allow selecting any team by first loading all departments' teams is bigger;
    // keep it simple: default to departmentId if present, otherwise leave blank (SUPER/ADMIN can also use other target types).
    if (departmentId) {
      void (async () => {
        try {
          const { data } = await api.get<TeamDto[]>(`/api/teams/department/${departmentId}`);
          setTeams(data);
          setSelectedTeamId(data[0]?.id ?? "");
        } catch {
          setTeams([]);
          setSelectedTeamId("");
        }
      })();
    } else {
      setTeams([]);
      setSelectedTeamId("");
    }
  }, [role, teamId, departmentId]);

  useEffect(() => {
    // Keep teams list in sync when SUPER/ADMIN chooses a department for targeting.
    const isSuper = role === "SUPER_ADMIN" || role === "ADMIN";
    if (!isSuper) return;
    if (targetType !== "TEAM") return;
    if (!selectedDeptId) {
      setTeams([]);
      setSelectedTeamId("");
      return;
    }
    void (async () => {
      try {
        const { data } = await api.get<TeamDto[]>(`/api/teams/department/${selectedDeptId}`);
        setTeams(data);
        setSelectedTeamId(data[0]?.id ?? "");
      } catch {
        setTeams([]);
        setSelectedTeamId("");
      }
    })();
  }, [role, targetType, selectedDeptId]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: number | undefined;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      es?.close();
      const url = `${baseURL}/api/notification/stream?access_token=${encodeURIComponent(token)}`;
      es = new EventSource(url);
      es.addEventListener("open", () => {
        attempt = 0;
        setHint(null);
      });
      es.addEventListener("notification", (ev) => {
        try {
          const n = JSON.parse((ev as MessageEvent).data) as NotificationDto;
          setItems((prev) => [n, ...prev]);
        } catch {
          void load();
        }
      });
      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        setHint("Live updates paused — reconnecting…");
        const delay = Math.min(60_000, 1000 * 2 ** Math.min(attempt, 8));
        attempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [token, baseURL]);

  async function markRead(id: string) {
    await api.patch(`/api/notification/${id}/read`);
    void load();
  }

  function openSchedule(n: NotificationDto) {
    if (!n.payloadJson) return;
    try {
      const payload = JSON.parse(n.payloadJson as string) as WeeklyScheduleResponse;
      if (!payload?.scheduleId) return;
      setScheduleNotificationId(n.id);
      setSchedulePayload(payload);
      setScheduleModalOpen(true);
    } catch {
      // ignore bad payloads
    }
  }

  async function sendTeam() {
    if (!sendText.trim()) return;
    setSendOk(null);
    try {
      if (role === "SUPER_ADMIN" || role === "ADMIN") {
        const body: Record<string, unknown> = {
          targetType,
          message: sendText.trim(),
        };
        if (targetType === "DEPARTMENT") body.departmentId = selectedDeptId || null;
        if (targetType === "TEAM") body.teamId = selectedTeamId || null;
        if (targetType === "EMPLOYEE") body.employeeUserId = selectedEmployeeUserId || null;
        await api.post("/api/notification/send", body);
      } else {
        const targetTeamId = role === "TEAM_LEADER" ? teamId : selectedTeamId;
        if (!targetTeamId) return;
        await api.post("/api/notification/send", {
          targetType: "TEAM",
          teamId: targetTeamId,
          message: sendText.trim(),
        });
      }
      setSendText("");
      setSendOk("Sent to your team.");
    } catch (e: unknown) {
      setSendOk(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Send failed",
      );
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Notifications</h1>

      {role === "EMPLOYEE" && unreadScheduleConfirm && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="text-sm font-semibold">Schedule awaiting confirmation</div>
          <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
            Open the schedule window to review your week before confirming.
          </div>
          <button
            type="button"
            className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => openSchedule(unreadScheduleConfirm)}
          >
            View schedule
          </button>
        </div>
      )}

      {(role === "SUPER_ADMIN" ||
        role === "ADMIN" ||
        role === "DEPT_MANAGER" ||
        (role === "TEAM_LEADER" && teamId)) && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-semibold">Send notification</h2>

          {(role === "SUPER_ADMIN" || role === "ADMIN") && (
            <label className="mt-2 block text-sm">
              Target
              <select
                className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={targetType}
                onChange={(e) => {
                  const v = e.target.value as TargetType;
                  setTargetType(v);
                  setSelectedDeptId("");
                  setSelectedTeamId("");
                  setSelectedEmployeeUserId("");
                }}
              >
                <option value="ALL_EMPLOYEES">All employees</option>
                <option value="DEPARTMENT">Specific department</option>
                <option value="TEAM">Specific team</option>
                <option value="EMPLOYEE">Specific employee</option>
              </select>
            </label>
          )}

          {(role === "SUPER_ADMIN" || role === "ADMIN") && targetType === "DEPARTMENT" && (
            <label className="mt-2 block text-sm">
              Department
              <select
                className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
              >
                <option value="">— Select —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(role === "SUPER_ADMIN" || role === "ADMIN") && targetType === "TEAM" && (
            <>
              <label className="mt-2 block text-sm">
                Department (optional)
                <select
                  className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-2 block text-sm">
                Team
                <select
                  className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {(role === "SUPER_ADMIN" || role === "ADMIN") && targetType === "EMPLOYEE" && (
            <label className="mt-2 block text-sm">
              Employee
              <select
                className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={selectedEmployeeUserId}
                onChange={(e) => setSelectedEmployeeUserId(e.target.value)}
              >
                <option value="">— Select —</option>
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </label>
          )}

          {(role === "DEPT_MANAGER" || role === "TEAM_LEADER" || role === "ADMIN" || role === "SUPER_ADMIN") &&
            role !== "TEAM_LEADER" &&
            role !== "SUPER_ADMIN" &&
            role !== "ADMIN" && (
              <label className="mt-2 block text-sm">
                Team
                <select
                  className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

          <textarea
            className="mt-2 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            rows={3}
            value={sendText}
            onChange={(e) => setSendText(e.target.value)}
            placeholder="Message to all employees on your team…"
          />
          <button
            type="button"
            onClick={() => void sendTeam()}
            className="mt-2 rounded bg-emerald-600 px-3 py-1 text-sm text-white"
          >
            Send
          </button>
          {sendOk && <p className="mt-2 text-sm text-zinc-600">{sendOk}</p>}
        </div>
      )}
      {hint && <p className="text-sm text-amber-600">{hint}</p>}
      <ul className="space-y-3">
        {items.map((n) => (
          <li
            key={n.id}
            className={`rounded-lg border p-4 dark:border-zinc-800 ${
              n.read ? "opacity-60" : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium">{n.senderName}</div>
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
                {n.type}
              </span>
            </div>
            <p className="mt-1 text-sm">{n.message}</p>
            {role === "EMPLOYEE" && n.type === "SCHEDULE_CONFIRM" && n.payloadJson && (
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                onClick={() => openSchedule(n)}
              >
                View schedule
              </button>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
              <span>{new Date(n.createdAt).toLocaleString()}</span>
              {!n.read && (
                <button
                  type="button"
                  className="text-emerald-600 hover:underline"
                  onClick={() => markRead(n.id)}
                >
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="text-zinc-500">No notifications yet.</p>}

      {scheduleModalOpen && scheduleNotificationId && schedulePayload && (
        <ScheduleConfirmModal
          open={scheduleModalOpen}
          notificationId={scheduleNotificationId}
          schedule={schedulePayload}
          onClose={() => setScheduleModalOpen(false)}
          onConfirmed={() => {
            setScheduleModalOpen(false);
            setScheduleNotificationId(null);
            setSchedulePayload(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
