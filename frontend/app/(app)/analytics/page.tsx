"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { extractApiMessage } from "@/lib/errors";
import type {
  AttendanceAbsentEmployeeDto,
  AttendanceAnalyticsPointDto,
  AttendanceAnalyticsResponseDto,
  AttendanceLateDayDto,
  AttendanceLateEmployeeDto,
  DepartmentDto,
  TeamDto,
  UserDto,
} from "@/lib/types";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { ModalScrim } from "@/components/ModalScrim";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function clampPct(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}

function fmtHours(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2)} h`;
}

function formatPeriodLabel(iso: string, granularity: "day" | "week" | "month") {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  if (granularity === "day") {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" });
  }
  if (granularity === "week") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Vertical stacks: top = on-time (blue), middle = late (blue + amber by lateness vs worked time), bottom = absent (rose). */
function VerticalBrickChart({
  points,
  granularity,
  onLateLegendClick,
  onAbsentLegendClick,
}: {
  points: AttendanceAnalyticsPointDto[];
  granularity: "day" | "week" | "month";
  onLateLegendClick?: () => void;
  onAbsentLegendClick?: () => void;
}) {
  const colStretch =
    granularity === "day"
      ? "min-w-[8px] max-w-[22px] shrink-0 flex-[1_1_8px]"
      : "min-w-[14px] max-w-[36px] shrink-0 flex-[1_1_14px]";
  const title =
    granularity === "day" ? "by day" : granularity === "week" ? "by week (Mon bucket)" : "by month";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 text-sm font-semibold capitalize">{title}</div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 shrink-0 rounded-sm bg-blue-600" />
          On-time
        </span>
        {onLateLegendClick ? (
          <button
            type="button"
            onClick={onLateLegendClick}
            className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-transparent px-1 py-0.5 text-left hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 shrink-0 rounded-sm bg-blue-600" />
              Late (remaining shift time)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 shrink-0 rounded-sm bg-amber-400" />
              Late (minutes late vs worked time)
            </span>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400">→ employee list</span>
          </button>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 shrink-0 rounded-sm bg-blue-600" />
              Late (remaining shift time)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 shrink-0 rounded-sm bg-amber-400" />
              Late (minutes late vs worked time)
            </span>
          </>
        )}
        {onAbsentLegendClick ? (
          <button
            type="button"
            onClick={onAbsentLegendClick}
            className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-1 py-0.5 hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <span className="h-3 w-3 shrink-0 rounded-sm bg-rose-600" />
            Absent
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400">→ employee list</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 shrink-0 rounded-sm bg-rose-600" />
            Absent
          </span>
        )}
      </div>

      {points.length === 0 ? (
        <div className="text-sm text-zinc-500">No data for this range.</div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div
            className="relative"
            style={{ minWidth: Math.max(280, points.length * (granularity === "day" ? 12 : 22)) }}
          >
            <div className="flex h-56 items-stretch gap-px pt-1">
            {points.map((p) => {
              const onT = clampPct(p.onTimePct);
              const la = clampPct(p.latePct);
              const ab = clampPct(p.absentPct);
              const ratio = Math.min(1, Math.max(0, (p.lateTimeVsWorkPct ?? 0) / 100));
              const lateInnerBlue = la > 0 ? (1 - ratio) * 100 : 0;
              const lateInnerAmber = la > 0 ? ratio * 100 : 0;
              const empty = onT + la + ab <= 0.001;

              return (
                <div key={p.periodStart} className={`flex flex-col items-stretch ${colStretch}`}>
                  <div className="flex h-52 w-full flex-col overflow-hidden rounded-sm border border-zinc-200/90 dark:border-zinc-700/90">
                    <div className="flex min-h-0 w-full flex-1 flex-col">
                      {!empty ? (
                        <>
                          {onT > 0 && (
                            <div
                              style={{ flexGrow: Math.max(0.001, onT) }}
                              className="min-h-0 bg-blue-600"
                              title={`On-time · ${fmtPct(onT)} of records`}
                            />
                          )}
                          {la > 0 && (
                            <div style={{ flexGrow: Math.max(0.001, la) }} className="flex min-h-0 flex-col">
                              {lateInnerBlue > 0 && (
                                <div
                                  style={{ flexGrow: Math.max(0.001, lateInnerBlue) }}
                                  className="min-h-0 bg-blue-600"
                                  title={`Late band · on-shift share · ${fmtPct(la)} late records`}
                                />
                              )}
                              {lateInnerAmber > 0 && (
                                <div
                                  style={{ flexGrow: Math.max(0.001, lateInnerAmber) }}
                                  className="min-h-0 bg-amber-400"
                                  title={`Late vs worked time · Σlate min / Σwork min ≈ ${fmtPct(p.lateTimeVsWorkPct ?? 0)}`}
                                />
                              )}
                            </div>
                          )}
                          {ab > 0 && (
                            <div
                              style={{ flexGrow: Math.max(0.001, ab) }}
                              className="min-h-0 bg-rose-600"
                              title={`Absent · ${fmtPct(ab)}`}
                            />
                          )}
                        </>
                      ) : (
                        <div className="min-h-[6px] flex-1 bg-zinc-200 dark:bg-zinc-800" title="No records" />
                      )}
                    </div>
                  </div>
                  <div
                    className="mt-1 max-w-[68px] truncate text-center text-[10px] leading-tight text-zinc-500"
                    title={p.periodStart}
                  >
                    {formatPeriodLabel(p.periodStart, granularity)}
                  </div>
                  <div className="truncate text-center text-[10px] text-zinc-400" title="Avg work hours (period)">
                    {fmtHours(p.avgWorkHours)}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const role = useAuthStore((s) => s.role);
  const authDeptId = useAuthStore((s) => s.departmentId);
  const authTeamId = useAuthStore((s) => s.teamId);

  const [from, setFrom] = useState(() => iso(daysAgo(30)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AttendanceAnalyticsResponseDto | null>(null);
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("week");

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");

  const [employees, setEmployees] = useState<UserDto[]>([]);
  const [employeeUserId, setEmployeeUserId] = useState<string>("");

  const [lateModalOpen, setLateModalOpen] = useState(false);
  const [absentModalOpen, setAbsentModalOpen] = useState(false);
  const [lateEmployees, setLateEmployees] = useState<AttendanceLateEmployeeDto[]>([]);
  const [absentEmployees, setAbsentEmployees] = useState<AttendanceAbsentEmployeeDto[]>([]);
  const [detailLoading, setDetailLoading] = useState<"late" | "absent" | null>(null);

  const [lateDetailUser, setLateDetailUser] = useState<AttendanceLateEmployeeDto | null>(null);
  const [lateDetailFrom, setLateDetailFrom] = useState("");
  const [lateDetailTo, setLateDetailTo] = useState("");
  const [lateDays, setLateDays] = useState<AttendanceLateDayDto[]>([]);
  const [lateDaysLoading, setLateDaysLoading] = useState(false);

  const isAdminScope = role === "SUPER_ADMIN" || role === "ADMIN";
  const isDeptManager = role === "DEPT_MANAGER";
  const isTeamLeader = role === "TEAM_LEADER";

  const analyticsParams = useMemo(() => {
    const params: Record<string, string | undefined> = { from, to };
    if (employeeUserId) {
      params.employeeUserId = employeeUserId;
    } else if (!isTeamLeader) {
      if (departmentId) params.departmentId = departmentId;
      if (teamId) params.teamId = teamId;
    }
    return params;
  }, [from, to, employeeUserId, departmentId, teamId, isTeamLeader]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AttendanceAnalyticsResponseDto>("/api/attendance/analytics", {
        params: analyticsParams,
      });
      setData(res.data);
    } catch (e) {
      setData(null);
      toast.error(extractApiMessage(e));
    } finally {
      setLoading(false);
    }
  }, [analyticsParams]);

  const loadLateDaysForUser = useCallback(
    async (userId: string, intervalFrom: string, intervalTo: string) => {
      if (!intervalFrom || !intervalTo) return;
      if (intervalFrom > intervalTo) {
        toast.error("End date must be on or after start date.");
        return;
      }
      setLateDaysLoading(true);
      try {
        const { data } = await api.get<AttendanceLateDayDto[]>(
          "/api/attendance/analytics/late-employee-days",
          {
            params: { userId, from: intervalFrom, to: intervalTo },
            skipGlobalLoading: true,
          },
        );
        setLateDays(data);
      } catch (e) {
        toast.error(extractApiMessage(e));
        setLateDays([]);
      } finally {
        setLateDaysLoading(false);
      }
    },
    [],
  );

  const openLateEmployeesModal = useCallback(async () => {
    setLateModalOpen(true);
    setLateDetailUser(null);
    setLateDays([]);
    setLateDetailFrom("");
    setLateDetailTo("");
    setDetailLoading("late");
    try {
      const { data } = await api.get<AttendanceLateEmployeeDto[]>(
        "/api/attendance/analytics/late-employees",
        { params: analyticsParams, skipGlobalLoading: true },
      );
      setLateEmployees(data);
    } catch (e) {
      toast.error(extractApiMessage(e));
      setLateEmployees([]);
    } finally {
      setDetailLoading(null);
    }
  }, [analyticsParams]);

  const onLateRowClick = useCallback(
    (r: AttendanceLateEmployeeDto) => {
      setLateDetailUser(r);
      setLateDetailFrom(from);
      setLateDetailTo(to);
      void loadLateDaysForUser(r.userId, from, to);
    },
    [from, to, loadLateDaysForUser],
  );

  const openAbsentEmployeesModal = useCallback(async () => {
    setAbsentModalOpen(true);
    setDetailLoading("absent");
    try {
      const { data } = await api.get<AttendanceAbsentEmployeeDto[]>(
        "/api/attendance/analytics/absent-employees",
        { params: analyticsParams, skipGlobalLoading: true },
      );
      setAbsentEmployees(data);
    } catch (e) {
      toast.error(extractApiMessage(e));
      setAbsentEmployees([]);
    } finally {
      setDetailLoading(null);
    }
  }, [analyticsParams]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<UserDto[]>("/api/users", { skipGlobalLoading: true });
        if (cancelled) return;
        setEmployees(res.data.filter((u) => u.role === "EMPLOYEE"));
      } catch {
        if (!cancelled) setEmployees([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdminScope && !isDeptManager && !isTeamLeader) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<DepartmentDto[]>("/api/departments", { skipGlobalLoading: true });
        if (!cancelled) setDepartments(res.data);
      } catch {
        if (!cancelled) setDepartments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdminScope, isDeptManager, isTeamLeader]);

  const effectiveDeptForTeams = isDeptManager ? authDeptId ?? "" : departmentId;

  useEffect(() => {
    const dept = effectiveDeptForTeams;
    if (!dept) {
      setTeams([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<TeamDto[]>(`/api/teams/department/${dept}`, {
          skipGlobalLoading: true,
        });
        if (!cancelled) setTeams(res.data);
      } catch {
        if (!cancelled) setTeams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveDeptForTeams]);

  useEffect(() => {
    if (!isAdminScope) return;
    setTeamId("");
  }, [departmentId, isAdminScope]);

  const scopedEmployees = useMemo(() => {
    let list = employees;
    if (isTeamLeader && authTeamId) {
      list = list.filter((u) => u.teamId === authTeamId);
    }
    if (isDeptManager && authDeptId) {
      list = list.filter((u) => u.departmentId === authDeptId);
      if (teamId) list = list.filter((u) => u.teamId === teamId);
    }
    if (isAdminScope) {
      if (departmentId) list = list.filter((u) => u.departmentId === departmentId);
      if (teamId) list = list.filter((u) => u.teamId === teamId);
    }
    return list;
  }, [employees, isTeamLeader, authTeamId, isDeptManager, authDeptId, teamId, isAdminScope, departmentId]);

  const scopeSummary = useMemo(() => {
    if (employeeUserId) {
      const u = employees.find((e) => e.id === employeeUserId);
      return u ? `Employee: ${u.name}` : "Single employee";
    }
    if (isTeamLeader) return "Scope: your team";
    if (isDeptManager) {
      const dn = departments.find((d) => d.id === authDeptId)?.name ?? "Your department";
      if (teamId) {
        const tn = teams.find((t) => t.id === teamId)?.name ?? "Team";
        return `Scope: ${dn} · ${tn}`;
      }
      return `Scope: ${dn} (all teams)`;
    }
    if (isAdminScope) {
      if (!departmentId) return "Scope: entire organization";
      const dn = departments.find((d) => d.id === departmentId)?.name ?? "Department";
      if (teamId) {
        const tn = teams.find((t) => t.id === teamId)?.name ?? "Team";
        return `Scope: ${dn} · ${tn}`;
      }
      return `Scope: ${dn} (all teams)`;
    }
    return "";
  }, [
    employeeUserId,
    employees,
    isTeamLeader,
    isDeptManager,
    departments,
    authDeptId,
    teamId,
    teams,
    isAdminScope,
    departmentId,
  ]);

  useEffect(() => {
    if (!employeeUserId) return;
    if (!scopedEmployees.some((u) => u.id === employeeUserId)) {
      setEmployeeUserId("");
    }
  }, [scopedEmployees, employeeUserId]);

  const points = useMemo(() => {
    if (!data) return [];
    if (granularity === "day") return data.daily;
    if (granularity === "week") return data.weekly;
    return data.monthly;
  }, [data, granularity]);

  const selectCls =
    "w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Attendance KPIs and trends (based on recorded attendance statuses).
          </p>
          {scopeSummary ? (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{scopeSummary}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {isAdminScope && (
            <>
              <div className="min-w-[200px]">
                <div className="text-xs text-zinc-500">Department</div>
                <select
                  className={selectCls}
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                  }}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[200px]">
                <div className="text-xs text-zinc-500">Team</div>
                <select
                  className={selectCls}
                  value={teamId}
                  disabled={!departmentId}
                  onChange={(e) => setTeamId(e.target.value)}
                >
                  <option value="">All teams (in department)</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {isDeptManager && (
            <div className="min-w-[220px]">
              <div className="text-xs text-zinc-500">Team</div>
              <select className={selectCls} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">Whole department</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isTeamLeader && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Department / team filters are fixed to your assignment.
            </div>
          )}

          <div className="min-w-[240px]">
            <div className="text-xs text-zinc-500">Employee</div>
            <select
              className={selectCls}
              value={employeeUserId}
              onChange={(e) => setEmployeeUserId(e.target.value)}
            >
              <option value="">All employees (current scope)</option>
              {scopedEmployees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.employeeId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-zinc-500">From</div>
            <input
              type="date"
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={to}
            />
          </div>
          <div>
            <div className="text-xs text-zinc-500">To</div>
            <input
              type="date"
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from}
            />
          </div>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs uppercase text-zinc-500">Present</div>
          <div className="mt-1 text-2xl font-semibold">{data ? fmtPct(data.presentPct) : "—"}</div>
          <div className="mt-1 text-xs text-zinc-500">{data ? `${data.presentCount} records` : ""}</div>
        </div>
        <button
          type="button"
          onClick={() => void openLateEmployeesModal()}
          className="rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-amber-400 hover:bg-amber-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-700 dark:hover:bg-amber-950/20"
        >
          <div className="text-xs uppercase text-zinc-500">Late</div>
          <div className="mt-1 text-2xl font-semibold">{data ? fmtPct(data.latePct) : "—"}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {data ? `${data.lateCount} records · click for employees (Σ minutes late)` : ""}
          </div>
        </button>
        <button
          type="button"
          onClick={() => void openAbsentEmployeesModal()}
          className="rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-rose-400 hover:bg-rose-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-rose-800 dark:hover:bg-rose-950/25"
        >
          <div className="text-xs uppercase text-zinc-500">Absent</div>
          <div className="mt-1 text-2xl font-semibold">{data ? fmtPct(data.absentPct) : "—"}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {data ? `${data.absentCount} records · click for employee list` : ""}
          </div>
        </button>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs uppercase text-zinc-500">Avg work hours</div>
          <div className="mt-1 text-2xl font-semibold">{data ? fmtHours(data.avgWorkHours) : "—"}</div>
          <div className="mt-1 text-xs text-zinc-500">{data ? `${data.totalRecords} total records` : ""}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm ${
            granularity === "day"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
              : "border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          }`}
          onClick={() => setGranularity("day")}
        >
          By day
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm ${
            granularity === "week"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
              : "border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          }`}
          onClick={() => setGranularity("week")}
        >
          By week
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm ${
            granularity === "month"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
              : "border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          }`}
          onClick={() => setGranularity("month")}
        >
          By month
        </button>

      </div>

      <VerticalBrickChart
        points={points}
        granularity={granularity}
        onLateLegendClick={() => void openLateEmployeesModal()}
        onAbsentLegendClick={() => void openAbsentEmployeesModal()}
      />

      {lateModalOpen && (
        <ModalScrim
          onDismiss={() => {
            setLateModalOpen(false);
            setLateDetailUser(null);
            setLateDays([]);
          }}
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10 backdrop-blur-[1px]"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-4xl rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">Late employees</h2>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                onClick={() => {
                  setLateModalOpen(false);
                  setLateDetailUser(null);
                  setLateDays([]);
                }}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Sorted by total late minutes (highest first). Click a row to load late dates; narrow the interval below the
              table (within the analytics date range).
            </p>
            {detailLoading === "late" ? (
              <p className="mt-4 text-sm text-zinc-500">Loading…</p>
            ) : lateEmployees.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No late records in this range.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-700">
                      <th className="py-2 pr-2">Employee</th>
                      <th className="py-2 pr-2">ID</th>
                      <th className="py-2 pr-2">Department</th>
                      <th className="py-2 pr-2">Team</th>
                      <th className="py-2 pr-2 text-right">Σ Late min</th>
                      <th className="py-2 text-right">Late days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lateEmployees.map((r) => {
                      const selected = lateDetailUser?.userId === r.userId;
                      return (
                        <tr
                          key={r.userId}
                          role="button"
                          tabIndex={0}
                          onClick={() => onLateRowClick(r)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onLateRowClick(r);
                            }
                          }}
                          className={`cursor-pointer border-b border-zinc-100 transition-colors dark:border-zinc-800 ${
                            selected
                              ? "bg-amber-100/90 ring-1 ring-inset ring-amber-400/80 dark:bg-amber-950/40 dark:ring-amber-700"
                              : "hover:bg-amber-50/90 dark:hover:bg-amber-950/25"
                          }`}
                        >
                          <td className="py-2 pr-2 font-medium">{r.name}</td>
                          <td className="py-2 pr-2 font-mono text-xs">{r.employeeId}</td>
                          <td className="py-2 pr-2">{r.departmentName ?? "—"}</td>
                          <td className="py-2 pr-2">{r.teamName ?? "—"}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.totalLateMinutes}</td>
                          <td className="py-2 text-right tabular-nums">{r.lateDayCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {lateDetailUser && (
              <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Late dates · {lateDetailUser.name}{" "}
                  <span className="font-normal text-zinc-500">({lateDetailUser.employeeId})</span>
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Interval must stay inside the current analytics range ({from} → {to}), max 62 days on the server.
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <div className="text-xs text-zinc-500">From</div>
                    <input
                      type="date"
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      value={lateDetailFrom}
                      min={from}
                      max={to}
                      onChange={(e) => setLateDetailFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">To</div>
                    <input
                      type="date"
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      value={lateDetailTo}
                      min={from}
                      max={to}
                      onChange={(e) => setLateDetailTo(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    disabled={lateDaysLoading || !lateDetailFrom || !lateDetailTo}
                    onClick={() =>
                      void loadLateDaysForUser(lateDetailUser.userId, lateDetailFrom, lateDetailTo)
                    }
                  >
                    Apply interval
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
                    onClick={() => {
                      setLateDetailUser(null);
                      setLateDays([]);
                    }}
                  >
                    Clear selection
                  </button>
                </div>

                {lateDaysLoading ? (
                  <p className="mt-4 text-sm text-zinc-500">Loading late dates…</p>
                ) : lateDays.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-500">No late days in this interval.</p>
                ) : (
                  <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950">
                        <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-700">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3 text-right">Minutes late</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lateDays.map((d) => (
                          <tr
                            key={d.recordDate}
                            className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/80"
                          >
                            <td className="px-3 py-2 font-mono text-xs">{d.recordDate}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{d.minutesLate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalScrim>
      )}

      {absentModalOpen && (
        <ModalScrim
          onDismiss={() => setAbsentModalOpen(false)}
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10 backdrop-blur-[1px]"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-3xl rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">Absent employees</h2>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                onClick={() => setAbsentModalOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Sorted by number of absent days (highest first). Dates use your browser timezone context from the API.
            </p>
            {detailLoading === "absent" ? (
              <p className="mt-4 text-sm text-zinc-500">Loading…</p>
            ) : absentEmployees.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No absent records in this range.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-700">
                      <th className="py-2 pr-2">Employee</th>
                      <th className="py-2 pr-2">ID</th>
                      <th className="py-2 pr-2">Department</th>
                      <th className="py-2 pr-2">Team</th>
                      <th className="py-2 pr-2 text-right">Absent days</th>
                      <th className="py-2">Dates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absentEmployees.map((r) => (
                      <tr
                        key={r.userId}
                        className="border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="py-2 pr-2 font-medium">{r.name}</td>
                        <td className="py-2 pr-2 font-mono text-xs">{r.employeeId}</td>
                        <td className="py-2 pr-2">{r.departmentName ?? "—"}</td>
                        <td className="py-2 pr-2">{r.teamName ?? "—"}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{r.absentDayCount}</td>
                        <td className="py-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {r.absentDates.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ModalScrim>
      )}

      {loading && <div className="text-sm text-zinc-500">Loading…</div>}
    </div>
  );
}
