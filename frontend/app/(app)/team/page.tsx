"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AttendanceRow, DepartmentDto, TeamDto } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { localDateISO } from "@/lib/dateUtils";

function clientTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Roles that see schedule vs plan indicators (aligned with backend). */
function canSeeScheduleVsPlan(role: string | null): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "DEPT_MANAGER" ||
    role === "TEAM_LEADER"
  );
}

export default function TeamPage() {
  const { teamId, departmentId, role } = useAuthStore();
  const showScheduleVsPlan = canSeeScheduleVsPlan(role);

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [date, setDate] = useState(() => localDateISO());
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  const loadTeamsForDepartment = useCallback(async (deptId: string) => {
    const { data } = await api.get<TeamDto[]>(`/api/teams/department/${deptId}`);
    const mapped = data.map((t) => ({ id: t.id, name: t.name }));
    setTeams(mapped);
    setSelectedTeam(mapped[0]?.id ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (role === "TEAM_LEADER" && teamId) {
        setDepartments([]);
        setSelectedDeptId(null);
        setTeams([{ id: teamId, name: "My team" }]);
        setSelectedTeam(teamId);
        return;
      }

      if (role === "DEPT_MANAGER") {
        setDepartments([]);
        if (!departmentId) {
          setTeams([]);
          setSelectedTeam(null);
          setSelectedDeptId(null);
          return;
        }
        setSelectedDeptId(departmentId);
        try {
          const { data } = await api.get<TeamDto[]>(`/api/teams/department/${departmentId}`);
          if (cancelled) return;
          const mapped = data.map((t) => ({ id: t.id, name: t.name }));
          setTeams(mapped);
          setSelectedTeam(mapped[0]?.id ?? null);
        } catch {
          if (!cancelled) {
            setTeams([]);
            setSelectedTeam(null);
          }
        }
        return;
      }

      if (role === "SUPER_ADMIN" || role === "ADMIN") {
        try {
          const { data: depts } = await api.get<DepartmentDto[]>("/api/departments");
          if (cancelled) return;
          setDepartments(depts);
          const initial =
            (departmentId && depts.some((d) => d.id === departmentId) ? departmentId : null) ??
            depts[0]?.id ??
            null;
          setSelectedDeptId(initial);
          if (initial) {
            const { data: teamList } = await api.get<TeamDto[]>(
              `/api/teams/department/${initial}`,
            );
            if (cancelled) return;
            const mapped = teamList.map((t) => ({ id: t.id, name: t.name }));
            setTeams(mapped);
            setSelectedTeam(mapped[0]?.id ?? null);
          } else {
            setTeams([]);
            setSelectedTeam(null);
          }
        } catch {
          if (!cancelled) {
            setDepartments([]);
            setTeams([]);
            setSelectedTeam(null);
            setSelectedDeptId(null);
          }
        }
        return;
      }

      setTeams([]);
      setSelectedTeam(null);
      setDepartments([]);
      setSelectedDeptId(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [role, teamId, departmentId]);

  async function onDepartmentChange(deptId: string) {
    setSelectedDeptId(deptId);
    try {
      await loadTeamsForDepartment(deptId);
    } catch {
      setTeams([]);
      setSelectedTeam(null);
    }
  }

  useEffect(() => {
    if (!selectedTeam) return;
    void (async () => {
      const { data } = await api.get<AttendanceRow[]>(`/api/attendance/team/${selectedTeam}`, {
        params: { date },
      });
      setRows(data);
    })();
  }, [selectedTeam, date]);

  function exportCsv() {
    if (!selectedTeam) return;
    const baseURL =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";
    const tok = useAuthStore.getState().token;
    const tz = clientTimeZone();
    const url = `${baseURL}/api/attendance/team/${selectedTeam}/export?date=${date}`;
    const headers: HeadersInit = { Authorization: `Bearer ${tok}` };
    if (tz) (headers as Record<string, string>)["X-Client-Timezone"] = tz;
    void fetch(url, { headers })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `attendance-${date}.csv`;
        a.click();
      })
      .catch(() => window.open(url, "_blank", "noopener"));
  }

  const showDepartmentPicker =
    role === "SUPER_ADMIN" || role === "ADMIN" ? departments.length > 0 : false;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Team attendance</h1>
      <p className="text-sm text-zinc-500">
        View employee attendance by scope:{" "}
        <strong className="text-zinc-700 dark:text-zinc-300">
          {role === "SUPER_ADMIN" && "All departments (select below)"}
          {role === "ADMIN" && "Departments you manage (select below)"}
          {role === "DEPT_MANAGER" && "Your department’s teams"}
          {role === "TEAM_LEADER" && "Your team only"}
        </strong>
      </p>

      {showDepartmentPicker && (
        <label className="text-sm">
          Department{" "}
          <select
            value={selectedDeptId ?? ""}
            onChange={(e) => void onDepartmentChange(e.target.value)}
            className="ml-2 min-w-[12rem] rounded border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {teams.length > 1 && (
        <label className="text-sm">
          Team{" "}
          <select
            value={selectedTeam ?? ""}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="ml-2 rounded border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {teams.length === 1 && role !== "TEAM_LEADER" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Team: <span className="font-medium">{teams[0]?.name}</span>
        </p>
      )}

      {teams.length === 0 && (
        <p className="text-sm text-zinc-500">No teams available for your scope.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Date{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
          />
        </label>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
        >
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="p-2">Employee</th>
              <th className="p-2">Status</th>
              {showScheduleVsPlan && (
                <th className="p-2" title="Compared to weekly schedule (start / end shift)">
                  Schedule
                </th>
              )}
              <th className="p-2">Punches</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="p-2">
                  {r.name}
                  <div className="font-mono text-xs text-zinc-500">{r.employeeId}</div>
                </td>
                <td className="p-2">{r.status ?? "—"}</td>
                {showScheduleVsPlan && (
                  <td className="p-2 text-center" title={r.scheduleVsPlanNote ?? undefined}>
                    {r.scheduleVsPlanOk === true && (
                      <span className="text-lg text-emerald-600 dark:text-emerald-400" aria-label="OK">
                        ✓
                      </span>
                    )}
                    {r.scheduleVsPlanOk === false && (
                      <span className="text-lg text-amber-600 dark:text-amber-400" aria-label="Issue">
                        ⚠
                      </span>
                    )}
                    {r.scheduleVsPlanOk == null && <span className="text-zinc-400">—</span>}
                  </td>
                )}
                <td className="p-2 text-xs">
                  {r.punches?.map((p) => p.type).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
