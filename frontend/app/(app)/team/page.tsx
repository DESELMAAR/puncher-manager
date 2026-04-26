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
import { useT } from "@/lib/useT";

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

function punchBadgeClass(type: string) {
  switch (type) {
    case "WORK_START":
      return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100";
    case "LOGOUT":
      return "border-zinc-300 bg-zinc-50 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

    case "BREAK1_START":
      return "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100";
    case "BREAK1_END":
      return "border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-100";

    case "LUNCH_START":
      return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";
    case "LUNCH_END":
      return "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100";

    case "BREAK2_START":
      return "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100";
    case "BREAK2_END":
      return "border-violet-200 bg-violet-100 text-violet-900 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-100";

    default:
      return "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200";
  }
}

function CopyButton({ value, title }: { value: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      title={title ?? "Copy"}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function fmtPunchTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function PunchBadges({
  punches,
  showTime,
}: {
  punches: AttendanceRow["punches"];
  showTime: boolean;
}) {
  const firstByType = useMemo(() => {
    const m = new Map<string, string>();
    const list = punches ?? [];
    for (const p of list) {
      if (!m.has(p.type)) m.set(p.type, p.punchedAt);
    }
    return m;
  }, [punches]);

  function durationTitle(startIso: string | null, endIso: string | null) {
    if (!startIso || !endIso) return undefined;
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return undefined;
    const totalMin = Math.round((e - s) / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
    return `Duration: ${dur}`;
  }

  function fmtRange(startIso: string | null, endIso: string | null) {
    if (!showTime) return "";
    const s = startIso ? fmtPunchTime(startIso) : "—";
    const e = endIso ? fmtPunchTime(endIso) : "—";
    return ` ${s}–${e}`;
  }

  if (!punches || punches.length === 0) return <span className="text-zinc-500">—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* WORK_START */}
      {firstByType.get("WORK_START") && (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] ${punchBadgeClass(
            "WORK_START",
          )}`}
          title={firstByType.get("WORK_START") ? new Date(firstByType.get("WORK_START")!).toLocaleString() : undefined}
        >
          WORK_START
          {showTime && (
            <span className="ml-1 opacity-70">{fmtPunchTime(firstByType.get("WORK_START")!)}</span>
          )}
        </span>
      )}

      {/* BREAK1 (START+END in one badge) */}
      {(firstByType.get("BREAK1_START") || firstByType.get("BREAK1_END")) && (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] ${punchBadgeClass(
            "BREAK1_START",
          )}`}
          title={
            durationTitle(
              firstByType.get("BREAK1_START") ?? null,
              firstByType.get("BREAK1_END") ?? null,
            ) ?? undefined
          }
        >
          BREAK1
          {showTime && (
            <span className="ml-1 opacity-70">
              {fmtRange(firstByType.get("BREAK1_START") ?? null, firstByType.get("BREAK1_END") ?? null)}
            </span>
          )}
        </span>
      )}

      {/* LUNCH (START+END in one badge) */}
      {(firstByType.get("LUNCH_START") || firstByType.get("LUNCH_END")) && (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] ${punchBadgeClass(
            "LUNCH_START",
          )}`}
          title={
            durationTitle(
              firstByType.get("LUNCH_START") ?? null,
              firstByType.get("LUNCH_END") ?? null,
            ) ?? undefined
          }
        >
          LUNCH
          {showTime && (
            <span className="ml-1 opacity-70">
              {fmtRange(firstByType.get("LUNCH_START") ?? null, firstByType.get("LUNCH_END") ?? null)}
            </span>
          )}
        </span>
      )}

      {/* BREAK2 (START+END in one badge) */}
      {(firstByType.get("BREAK2_START") || firstByType.get("BREAK2_END")) && (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] ${punchBadgeClass(
            "BREAK2_START",
          )}`}
          title={
            durationTitle(
              firstByType.get("BREAK2_START") ?? null,
              firstByType.get("BREAK2_END") ?? null,
            ) ?? undefined
          }
        >
          BREAK2
          {showTime && (
            <span className="ml-1 opacity-70">
              {fmtRange(firstByType.get("BREAK2_START") ?? null, firstByType.get("BREAK2_END") ?? null)}
            </span>
          )}
        </span>
      )}

      {/* LOGOUT */}
      {firstByType.get("LOGOUT") && (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] ${punchBadgeClass(
            "LOGOUT",
          )}`}
          title={firstByType.get("LOGOUT") ? new Date(firstByType.get("LOGOUT")!).toLocaleString() : undefined}
        >
          LOGOUT
          {showTime && (
            <span className="ml-1 opacity-70">{fmtPunchTime(firstByType.get("LOGOUT")!)}</span>
          )}
        </span>
      )}
    </div>
  );
}

export default function TeamPage() {
  const t = useT();
  const { teamId, departmentId, role } = useAuthStore();
  const showScheduleVsPlan = canSeeScheduleVsPlan(role);

  const [openRow, setOpenRow] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [openPunchTimes, setOpenPunchTimes] = useState<Set<string>>(() => new Set());
  const [expandAllPunchTimes, setExpandAllPunchTimes] = useState(false);

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
      <h1 className="text-2xl font-bold">{t("team.title")}</h1>
      <p className="text-sm text-zinc-500">
        {t("team.scopePrefix")}{" "}
        <strong className="text-zinc-700 dark:text-zinc-300">
          {role === "SUPER_ADMIN" && t("team.scope.superAdmin")}
          {role === "ADMIN" && t("team.scope.admin")}
          {role === "DEPT_MANAGER" && t("team.scope.deptManager")}
          {role === "TEAM_LEADER" && t("team.scope.teamLeader")}
        </strong>
      </p>

      {showDepartmentPicker && (
        <label className="text-sm">
          {t("label.department")}{" "}
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
          {t("label.team")}{" "}
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
          {t("label.team")}: <span className="font-medium">{teams[0]?.name}</span>
        </p>
      )}

      {teams.length === 0 && (
        <p className="text-sm text-zinc-500">{t("attendance.noTeams")}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <input
            type="checkbox"
            className="mr-2 align-middle"
            checked={overviewMode}
            onChange={(e) => setOverviewMode(e.target.checked)}
          />
          {t("attendance.overview")}
        </label>
        <label className="text-sm">
          <input
            type="checkbox"
            className="mr-2 align-middle"
            checked={rangeMode}
            onChange={(e) => setRangeMode(e.target.checked)}
          />
          {t("attendance.range")}
        </label>
        <label className="text-sm">
          {rangeMode ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>{t("label.from")}</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <span>{t("label.to")}</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </span>
          ) : (
            <>
              {t("label.date")}{" "}
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
          {t("action.exportCsv")}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          {t("label.search")}{" "}
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
            {t("action.clear")}
          </button>
        )}
      </div>

      {!overviewMode && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                {rangeMode && <th className="p-2">{t("table.date")}</th>}
                <th className="p-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      aria-label={expandAll ? "Collapse all rows" : "Expand all rows"}
                      aria-pressed={expandAll}
                      title={expandAll ? "Collapse all rows" : "Expand all rows"}
                      onClick={() => {
                        setExpandAll((v) => !v);
                        setOpenRow(null);
                      }}
                    >
                      <span
                        className={`inline-block transition-transform ${expandAll ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      >
                        ▾
                      </span>
                    </button>
                    <span>{t("table.employee")}</span>
                  </div>
                </th>
                <th className="p-2">{t("table.status")}</th>
                {showScheduleVsPlan && (
                  <th className="p-2" title="Compared to weekly schedule (start / end shift)">
                    {t("table.schedule")}
                  </th>
                )}
                <th className="p-2">{t("table.deptManager")}</th>
                <th className="p-2">{t("table.teamLeader")}</th>
                <th className="p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>{t("table.punches")}</span>
                    <button
                      type="button"
                      className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      aria-label={expandAllPunchTimes ? "Collapse punch times for all rows" : "Expand punch times for all rows"}
                      aria-pressed={expandAllPunchTimes}
                      title={expandAllPunchTimes ? "Collapse punch times for all rows" : "Expand punch times for all rows"}
                      onClick={() => {
                        setExpandAllPunchTimes((v) => !v);
                        setOpenPunchTimes(new Set());
                      }}
                    >
                      {expandAllPunchTimes ? "−" : "+"}
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const rowKey = `${r.userId}-${r.recordDate}`;
                const expanded = expandAll || openRow === rowKey;
                const punchesExpanded = openPunchTimes.has(rowKey);
                return (
                  <tr
                    key={rowKey}
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label="Toggle details"
                            aria-expanded={expanded}
                            onClick={() => setOpenRow((cur) => (cur === rowKey ? null : rowKey))}
                            disabled={expandAll}
                            title={expandAll ? "Disable expand-all to toggle individually" : "Toggle row details"}
                          >
                            <span
                              className={`inline-block transition-transform ${
                                expanded ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            >
                              ▾
                            </span>
                          </button>
                          <span className="font-medium">{r.name}</span>
                        </div>
                        {expanded && (
                          <div className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                            {r.employeeId}
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
                      <td className="p-2 text-zinc-700 dark:text-zinc-300">
                        {r.deptManagerName ?? "—"}
                        {expanded && r.deptManagerEmail && (
                          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span>{r.deptManagerEmail}</span>
                            <CopyButton
                              value={r.deptManagerEmail}
                              title="Copy dept manager email"
                            />
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-zinc-700 dark:text-zinc-300">
                        {r.teamLeaderName ?? "—"}
                        {expanded && r.teamLeaderEmail && (
                          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span>{r.teamLeaderEmail}</span>
                            <CopyButton
                              value={r.teamLeaderEmail}
                              title="Copy team leader email"
                            />
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <PunchBadges
                              punches={r.punches}
                              showTime={expanded || punchesExpanded || expandAllPunchTimes}
                            />
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label={punchesExpanded ? "Hide punch times" : "Show punch times"}
                            title={punchesExpanded ? "Hide punch times" : "Show punch times"}
                            onClick={() =>
                              setOpenPunchTimes((prev) => {
                                const next = new Set(prev);
                                if (next.has(rowKey)) next.delete(rowKey);
                                else next.add(rowKey);
                                return next;
                              })
                            }
                            disabled={expandAllPunchTimes}
                            aria-disabled={expandAllPunchTimes}
                          >
                            {punchesExpanded ? "−" : "+"}
                          </button>
                        </div>
                      </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    className="p-3 text-sm text-zinc-500"
                    colSpan={rangeMode ? 7 : 6}
                  >
                    {t("attendance.noMatches")}
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
              <div className="border-t border-zinc-200 bg-white/40 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-black/5 dark:text-zinc-300">
                {t("table.deptManager")}: <span className="font-medium">{g.rows[0]?.deptManagerName ?? "—"}</span>{" "}
                • {t("table.teamLeader")}:{" "}
                <span className="font-medium">{g.rows[0]?.teamLeaderName ?? "—"}</span>
              </div>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-t border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/60">
                    {rangeMode && <th className="p-2">Date</th>}
                    <th className="p-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          aria-label={expandAll ? "Collapse all rows" : "Expand all rows"}
                          aria-pressed={expandAll}
                          title={expandAll ? "Collapse all rows" : "Expand all rows"}
                          onClick={() => {
                            setExpandAll((v) => !v);
                            setOpenRow(null);
                          }}
                        >
                          <span
                            className={`inline-block transition-transform ${expandAll ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          >
                            ▾
                          </span>
                        </button>
                        <span>Employee</span>
                      </div>
                    </th>
                    <th className="p-2">Status</th>
                    {showScheduleVsPlan && <th className="p-2">Schedule</th>}
                    <th className="p-2">{t("table.deptManager")}</th>
                    <th className="p-2">{t("table.teamLeader")}</th>
                    <th className="p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span>{t("table.punches")}</span>
                        <button
                          type="button"
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          aria-label={expandAllPunchTimes ? "Collapse punch times for all rows" : "Expand punch times for all rows"}
                          aria-pressed={expandAllPunchTimes}
                          title={expandAllPunchTimes ? "Collapse punch times for all rows" : "Expand punch times for all rows"}
                          onClick={() => {
                            setExpandAllPunchTimes((v) => !v);
                            setOpenPunchTimes(new Set());
                          }}
                        >
                          {expandAllPunchTimes ? "−" : "+"}
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => {
                    const rowKey = `${g.teamId}-${r.userId}-${r.recordDate}`;
                    const expanded = expandAll || openRow === rowKey;
                    const punchesExpanded = openPunchTimes.has(rowKey);
                    return (
                    <tr
                      key={rowKey}
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label="Toggle details"
                            aria-expanded={expanded}
                            onClick={() => setOpenRow((cur) => (cur === rowKey ? null : rowKey))}
                            disabled={expandAll}
                            title={expandAll ? "Disable expand-all to toggle individually" : "Toggle row details"}
                          >
                            <span
                              className={`inline-block transition-transform ${
                                expanded ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            >
                              ▾
                            </span>
                          </button>
                          <span className="font-medium">{r.name}</span>
                        </div>
                        {expanded && (
                          <div className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                            {r.employeeId}
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
                      <td className="p-2 text-zinc-700 dark:text-zinc-300">
                        <div>{r.deptManagerName ?? "—"}</div>
                        {expanded && r.deptManagerEmail && (
                          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span>{r.deptManagerEmail}</span>
                            <CopyButton
                              value={r.deptManagerEmail}
                              title="Copy dept manager email"
                            />
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-zinc-700 dark:text-zinc-300">
                        <div>{r.teamLeaderName ?? "—"}</div>
                        {expanded && r.teamLeaderEmail && (
                          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span>{r.teamLeaderEmail}</span>
                            <CopyButton
                              value={r.teamLeaderEmail}
                              title="Copy team leader email"
                            />
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <PunchBadges
                              punches={r.punches}
                              showTime={expanded || punchesExpanded || expandAllPunchTimes}
                            />
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label={punchesExpanded ? "Hide punch times" : "Show punch times"}
                            title={punchesExpanded ? "Hide punch times" : "Show punch times"}
                            onClick={() =>
                              setOpenPunchTimes((prev) => {
                                const next = new Set(prev);
                                if (next.has(rowKey)) next.delete(rowKey);
                                else next.add(rowKey);
                                return next;
                              })
                            }
                            disabled={expandAllPunchTimes}
                            aria-disabled={expandAllPunchTimes}
                          >
                            {punchesExpanded ? "−" : "+"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
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
