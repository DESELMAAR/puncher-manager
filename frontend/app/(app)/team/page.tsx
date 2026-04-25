"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  AttendanceOverviewGroupDto,
  AttendanceRow,
  DepartmentDto,
  TeamDto,
} from "@/lib/types";
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

function dayColorClass(isoDate: string) {
  // Stable, subtle backgrounds per day to visually separate periods in range mode.
  // Using a tiny hash keeps the same date the same color across views.
  let h = 0;
  for (let i = 0; i < isoDate.length; i++) h = (h * 31 + isoDate.charCodeAt(i)) >>> 0;
  const palette = [
    "bg-sky-100/80 dark:bg-sky-900/35",
    "bg-emerald-100/80 dark:bg-emerald-900/35",
    "bg-amber-100/80 dark:bg-amber-900/35",
    "bg-violet-100/80 dark:bg-violet-900/35",
    "bg-rose-100/80 dark:bg-rose-900/35",
    "bg-teal-100/80 dark:bg-teal-900/35",
  ];
  return palette[h % palette.length]!;
}

function teamAccentClass(teamId: string) {
  // Stable team accent colors for overview cards.
  let h = 0;
  for (let i = 0; i < teamId.length; i++) h = (h * 31 + teamId.charCodeAt(i)) >>> 0;
  const palette = [
    "border-sky-300/70 bg-sky-50/60 dark:border-sky-700/70 dark:bg-sky-950/25",
    "border-emerald-300/70 bg-emerald-50/60 dark:border-emerald-700/70 dark:bg-emerald-950/25",
    "border-amber-300/70 bg-amber-50/60 dark:border-amber-700/70 dark:bg-amber-950/25",
    "border-violet-300/70 bg-violet-50/60 dark:border-violet-700/70 dark:bg-violet-950/25",
    "border-rose-300/70 bg-rose-50/60 dark:border-rose-700/70 dark:bg-rose-950/25",
    "border-teal-300/70 bg-teal-50/60 dark:border-teal-700/70 dark:bg-teal-950/25",
  ];
  return palette[h % palette.length]!;
}

export default function TeamPage() {
  const { teamId, departmentId, role } = useAuthStore();
  const showScheduleVsPlan = canSeeScheduleVsPlan(role);

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [date, setDate] = useState(() => localDateISO());
  const [rangeMode, setRangeMode] = useState(false);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localDateISO(d);
  });
  const [to, setTo] = useState(() => localDateISO());
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [overviewMode, setOverviewMode] = useState(false);
  const [overview, setOverview] = useState<AttendanceOverviewGroupDto[]>([]);

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
    if (overviewMode) return;
    if (!selectedTeam) return;
    void (async () => {
      const params = rangeMode ? { from, to } : { date };
      const { data } = await api.get<AttendanceRow[]>(
        `/api/attendance/team/${selectedTeam}`,
        { params },
      );
      setRows(data);
    })();
  }, [overviewMode, selectedTeam, rangeMode, date, from, to]);

  useEffect(() => {
    if (!overviewMode) return;
    void (async () => {
      const params = rangeMode ? { from, to } : { date };
      const { data } = await api.get<AttendanceOverviewGroupDto[]>(
        `/api/attendance/overview`,
        { params },
      );
      setOverview(data);
    })();
  }, [overviewMode, rangeMode, date, from, to]);

  function exportCsv() {
    if (overviewMode) return;
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

  const q = query.trim().toLowerCase();
  const matches = useCallback(
    (r: AttendanceRow) => {
      if (!q) return true;
      const name = (r.name ?? "").toLowerCase();
      const empId = (r.employeeId ?? "").toLowerCase();
      // Email isn't currently included in AttendanceRow; keep this ready if you add it later.
      const email = ((r as unknown as { email?: string }).email ?? "").toLowerCase();
      return name.includes(q) || empId.includes(q) || email.includes(q);
    },
    [q],
  );

  const filteredRows = useMemo(() => rows.filter(matches), [rows, matches]);

  const grouped = useMemo(() => {
    if (!q) return overview;
    return overview
      .map((g) => ({ ...g, rows: g.rows.filter(matches) }))
      .filter((g) => g.rows.length > 0);
  }, [overview, matches, q]);

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
          <input
            type="checkbox"
            className="mr-2 align-middle"
            checked={overviewMode}
            onChange={(e) => setOverviewMode(e.target.checked)}
          />
          Overview (all teams)
        </label>
        <label className="text-sm">
          <input
            type="checkbox"
            className="mr-2 align-middle"
            checked={rangeMode}
            onChange={(e) => setRangeMode(e.target.checked)}
          />
          Range (up to 2 months)
        </label>
        <label className="text-sm">
          {rangeMode ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <span>To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </span>
          ) : (
            <>
              Date{" "}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </>
          )}
        </label>
        <button
          type="button"
          onClick={exportCsv}
          disabled={overviewMode || !selectedTeam}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Search{" "}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Employee ID or name or email"
            className="ml-1 w-72 max-w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
          />
        </label>
        {query.trim() && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
          >
            Clear
          </button>
        )}
      </div>

      {!overviewMode && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                {rangeMode && <th className="p-2">Date</th>}
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
              {filteredRows.map((r) => (
                <tr
                  key={`${r.userId}-${r.recordDate}`}
                  className={`border-t border-zinc-200 dark:border-zinc-800 ${
                    rangeMode ? dayColorClass(r.recordDate) : ""
                  }`}
                >
                  {rangeMode && (
                    <td className="p-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {r.recordDate}
                    </td>
                  )}
                  <td className="p-2">
                    {r.name}
                    <div className="font-mono text-xs text-zinc-500">{r.employeeId}</div>
                    {(r.departmentName || r.teamName) && (
                      <div className="text-xs text-zinc-500">
                        {r.departmentName ?? "—"} {" · "} {r.teamName ?? "—"}
                      </div>
                    )}
                  </td>
                  <td className="p-2">{r.status ?? "—"}</td>
                  {showScheduleVsPlan && (
                    <td className="p-2 text-center" title={r.scheduleVsPlanNote ?? undefined}>
                      {r.scheduleVsPlanOk === true && (
                        <span
                          className="text-lg text-emerald-600 dark:text-emerald-400"
                          aria-label="OK"
                        >
                          ✓
                        </span>
                      )}
                      {r.scheduleVsPlanOk === false && (
                        <span
                          className="text-lg text-amber-600 dark:text-amber-400"
                          aria-label="Issue"
                        >
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
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    className="p-3 text-sm text-zinc-500"
                    colSpan={rangeMode ? 5 : 4}
                  >
                    No matching employees.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {overviewMode && (
        <div className="space-y-3">
          {grouped.map((g) => (
            <div
              key={g.teamId}
              className={`overflow-x-auto rounded-lg border ${teamAccentClass(g.teamId)}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 bg-white/40 px-3 py-2 dark:bg-black/10">
                <div className="font-medium">
                  {g.departmentName} / {g.teamName}
                </div>
                <div className="text-xs text-zinc-500">
                  {g.rows.length} employee{g.rows.length === 1 ? "" : "s"}
                </div>
              </div>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-t border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/60">
                    {rangeMode && <th className="p-2">Date</th>}
                    <th className="p-2">Employee</th>
                    <th className="p-2">Status</th>
                    {showScheduleVsPlan && <th className="p-2">Schedule</th>}
                    <th className="p-2">Punches</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr
                      key={`${g.teamId}-${r.userId}-${r.recordDate}`}
                      className={`border-t border-zinc-200 dark:border-zinc-800 ${
                        rangeMode ? dayColorClass(r.recordDate) : ""
                      }`}
                    >
                      {rangeMode && (
                        <td className="p-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                          {r.recordDate}
                        </td>
                      )}
                      <td className="p-2">
                        {r.name}
                        <div className="font-mono text-xs text-zinc-500">{r.employeeId}</div>
                        {(r.departmentName || r.teamName) && (
                          <div className="text-xs text-zinc-500">
                            {r.departmentName ?? "—"} {" · "} {r.teamName ?? "—"}
                          </div>
                        )}
                      </td>
                      <td className="p-2">{r.status ?? "—"}</td>
                      {showScheduleVsPlan && (
                        <td className="p-2 text-center" title={r.scheduleVsPlanNote ?? undefined}>
                          {r.scheduleVsPlanOk === true && (
                            <span
                              className="text-lg text-emerald-600 dark:text-emerald-400"
                              aria-label="OK"
                            >
                              ✓
                            </span>
                          )}
                          {r.scheduleVsPlanOk === false && (
                            <span
                              className="text-lg text-amber-600 dark:text-amber-400"
                              aria-label="Issue"
                            >
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
          ))}
          {grouped.length === 0 && (
            <p className="text-sm text-zinc-500">No teams available for your scope.</p>
          )}
        </div>
      )}
    </div>
  );
}
