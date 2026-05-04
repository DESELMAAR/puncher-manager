"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { extractApiMessage } from "@/lib/errors";
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

const ALL_TEAMS = "__ALL_TEAMS__";

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

function parseHourFromTimeString(t: string | null | undefined): number | null {
  if (!t) return null;
  // Accept "HH:mm" or "HH:mm:ss"
  const hh = Number.parseInt(t.slice(0, 2), 10);
  return Number.isFinite(hh) ? hh : null;
}

function startHourForIndent(row: AttendanceRow): number | null {
  const h = parseHourFromTimeString(row.expectedStart);
  if (h != null) return h;
  const ws = row.punches?.find((p) => p.type === "WORK_START")?.punchedAt;
  if (!ws) return null;
  const d = new Date(ws);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours();
}

function clampHour(h: number): number {
  if (h < 0) return 0;
  if (h > 23) return 23;
  return h;
}

function PunchBadges({
  punches,
  showTime,
  indentPx,
  showDurations,
}: {
  punches: AttendanceRow["punches"];
  showTime: boolean;
  indentPx?: number;
  showDurations?: boolean;
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

  const workMin = minutesBetween(firstByType.get("WORK_START"), firstByType.get("LOGOUT"));
  const lunchMin = minutesBetween(firstByType.get("LUNCH_START"), firstByType.get("LUNCH_END"));
  const break1Min = minutesBetween(firstByType.get("BREAK1_START"), firstByType.get("BREAK1_END"));
  const break2Min = minutesBetween(firstByType.get("BREAK2_START"), firstByType.get("BREAK2_END"));
  const breaksMin =
    break1Min != null || break2Min != null ? (break1Min ?? 0) + (break2Min ?? 0) : null;

  return (
    <div className="flex flex-wrap gap-1.5" style={indentPx ? { marginLeft: indentPx } : undefined}>
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

      {showTime && showDurations && (
        <>
          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
            WORK <span className="ml-1 opacity-70">{fmtMinutes(workMin)}</span>
          </span>
          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
            LUNCH <span className="ml-1 opacity-70">{fmtMinutes(lunchMin)}</span>
          </span>
          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
            BREAKS <span className="ml-1 opacity-70">{fmtMinutes(breaksMin)}</span>
          </span>
        </>
      )}
    </div>
  );
}

function minutesBetween(startIso: string | null | undefined, endIso: string | null | undefined): number | null {
  if (!startIso || !endIso) return null;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
  return Math.round((e - s) / 60000);
}

function fmtMinutes(totalMin: number | null): string {
  if (totalMin == null) return "—";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function TeamPage() {
  const t = useT();
  const { teamId, departmentId, role } = useAuthStore();
  const showScheduleVsPlan = canSeeScheduleVsPlan(role);

  const ATTENDANCE_FILTERS_KEY = "attendance.teamPage.filters.v1";

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
  const [overviewMode, setOverviewMode] = useState(true);
  const [overview, setOverview] = useState<AttendanceOverviewGroupDto[]>([]);
  const [exportScope, setExportScope] = useState<"ALL" | "DEPARTMENT" | "TEAM">("TEAM");
  const [lateGraceMinutesInput, setLateGraceMinutesInput] = useState<string>("");
  const [allowedLunchMinutesInput, setAllowedLunchMinutesInput] = useState<string>("");
  const [allowedBreaksMinutesInput, setAllowedBreaksMinutesInput] = useState<string>("");
  const [otherSettingsOpen, setOtherSettingsOpen] = useState(false);
  const otherSettingsRef = useRef<HTMLDivElement>(null);
  const [showOverviewUncheckArrow, setShowOverviewUncheckArrow] = useState(false);
  const [filtersRestored, setFiltersRestored] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(ATTENDANCE_FILTERS_KEY);
      if (!raw) {
        setFiltersRestored(true);
        return;
      }
      const v = JSON.parse(raw) as Partial<{
        overviewMode: boolean;
        rangeMode: boolean;
        date: string;
        from: string;
        to: string;
        query: string;
        selectedDeptId: string | null;
        selectedTeam: string | null;
        exportScope: "ALL" | "DEPARTMENT" | "TEAM";
      }>;

      if (typeof v.overviewMode === "boolean") setOverviewMode(v.overviewMode);
      if (typeof v.rangeMode === "boolean") setRangeMode(v.rangeMode);
      if (typeof v.date === "string" && v.date) setDate(v.date);
      if (typeof v.from === "string" && v.from) setFrom(v.from);
      if (typeof v.to === "string" && v.to) setTo(v.to);
      if (typeof v.query === "string") setQuery(v.query);
      if (typeof v.exportScope === "string") setExportScope(v.exportScope);

      // Only restore dept/team selections for roles that can change them.
      if (role === "SUPER_ADMIN" || role === "ADMIN") {
        if (typeof v.selectedDeptId === "string" || v.selectedDeptId === null) {
          setSelectedDeptId(v.selectedDeptId ?? null);
        }
        if (typeof v.selectedTeam === "string" || v.selectedTeam === null) {
          setSelectedTeam(v.selectedTeam ?? null);
        }
      } else if (role === "DEPT_MANAGER") {
        if (typeof v.selectedTeam === "string" || v.selectedTeam === null) {
          setSelectedTeam(v.selectedTeam ?? null);
        }
      }
    } catch {
      // ignore malformed storage
    } finally {
      setFiltersRestored(true);
    }
  }, [role]);

  useEffect(() => {
    if (!filtersRestored) return;
    if (typeof window === "undefined") return;
    const payload = {
      overviewMode,
      rangeMode,
      date,
      from,
      to,
      query,
      selectedDeptId,
      selectedTeam,
      exportScope,
    };
    try {
      window.sessionStorage.setItem(ATTENDANCE_FILTERS_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota / privacy mode
    }
  }, [
    filtersRestored,
    overviewMode,
    rangeMode,
    date,
    from,
    to,
    query,
    selectedDeptId,
    selectedTeam,
    exportScope,
  ]);

  useEffect(() => {
    if (!overviewMode) setShowOverviewUncheckArrow(false);
  }, [overviewMode]);

  useEffect(() => {
    if (!showOverviewUncheckArrow) return;
    const id = window.setTimeout(() => setShowOverviewUncheckArrow(false), 14_000);
    return () => window.clearTimeout(id);
  }, [showOverviewUncheckArrow]);

  useEffect(() => {
    if (!otherSettingsOpen) return;
    function onPointerDown(ev: PointerEvent) {
      const t = ev.target;
      if (!(t instanceof Node)) return;
      if (otherSettingsRef.current?.contains(t)) return;
      setOtherSettingsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [otherSettingsOpen]);

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
        if (!departmentId) {
          setTeams([]);
          setSelectedTeam(null);
          setSelectedDeptId(null);
          return;
        }
        setSelectedDeptId(departmentId);
        try {
          const { data: depts } = await api.get<DepartmentDto[]>("/api/departments");
          if (cancelled) return;
          setDepartments(depts);
          const myDept = depts.find((d) => d.id === departmentId);
          setLateGraceMinutesInput(
            myDept?.lateGraceMinutes != null ? String(myDept.lateGraceMinutes) : "",
          );
          setAllowedLunchMinutesInput(
            myDept?.allowedLunchMinutes != null ? String(myDept.allowedLunchMinutes) : "",
          );
          setAllowedBreaksMinutesInput(
            myDept?.allowedBreaksMinutes != null ? String(myDept.allowedBreaksMinutes) : "",
          );

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
          const deptForGrace = depts.find((d) => d.id === initial);
          setLateGraceMinutesInput(
            deptForGrace?.lateGraceMinutes != null ? String(deptForGrace.lateGraceMinutes) : "",
          );
          setAllowedLunchMinutesInput(
            deptForGrace?.allowedLunchMinutes != null ? String(deptForGrace.allowedLunchMinutes) : "",
          );
          setAllowedBreaksMinutesInput(
            deptForGrace?.allowedBreaksMinutes != null
              ? String(deptForGrace.allowedBreaksMinutes)
              : "",
          );
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
      const dept = departments.find((d) => d.id === deptId);
      setLateGraceMinutesInput(dept?.lateGraceMinutes != null ? String(dept.lateGraceMinutes) : "");
      setAllowedLunchMinutesInput(
        dept?.allowedLunchMinutes != null ? String(dept.allowedLunchMinutes) : "",
      );
      setAllowedBreaksMinutesInput(
        dept?.allowedBreaksMinutes != null ? String(dept.allowedBreaksMinutes) : "",
      );
      await loadTeamsForDepartment(deptId);
    } catch {
      setTeams([]);
      setSelectedTeam(null);
    }
  }

  const canEditLateGrace =
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "DEPT_MANAGER";

  async function saveLateGraceMinutes() {
    if (!canEditLateGrace) return;
    const deptId = selectedDeptId ?? departmentId ?? "";
    if (!deptId) return;
    const v = lateGraceMinutesInput.trim();
    const minutes = v === "" ? null : Number(v);
    if (minutes != null && (!Number.isFinite(minutes) || minutes < 0 || minutes > 120)) {
      toast.error("Grace minutes must be between 0 and 120");
      return;
    }
    try {
      const { data } = await api.put<DepartmentDto>(`/api/departments/${deptId}/grace`, {
        lateGraceMinutes: minutes,
      });
      setDepartments((prev) => prev.map((d) => (d.id === deptId ? { ...d, ...data } : d)));
      setLateGraceMinutesInput(
        data.lateGraceMinutes != null ? String(data.lateGraceMinutes) : "",
      );
      toast.success("Grace time updated");
      setOtherSettingsOpen(false);
    } catch (e) {
      toast.error(extractApiMessage(e));
    }
  }

  async function saveAllowedDurations() {
    if (!canEditLateGrace) return;
    const deptId = selectedDeptId ?? departmentId ?? "";
    if (!deptId) return;
    const lunchRaw = allowedLunchMinutesInput.trim();
    const breaksRaw = allowedBreaksMinutesInput.trim();
    const allowedLunchMinutes = lunchRaw === "" ? null : Number(lunchRaw);
    const allowedBreaksMinutes = breaksRaw === "" ? null : Number(breaksRaw);
    if (
      allowedLunchMinutes != null &&
      (!Number.isFinite(allowedLunchMinutes) || allowedLunchMinutes < 0 || allowedLunchMinutes > 300)
    ) {
      toast.error("Allowed lunch minutes must be between 0 and 300");
      return;
    }
    if (
      allowedBreaksMinutes != null &&
      (!Number.isFinite(allowedBreaksMinutes) || allowedBreaksMinutes < 0 || allowedBreaksMinutes > 300)
    ) {
      toast.error("Allowed breaks minutes must be between 0 and 300");
      return;
    }
    try {
      const { data } = await api.put<DepartmentDto>(`/api/departments/${deptId}/durations`, {
        allowedLunchMinutes,
        allowedBreaksMinutes,
      });
      setDepartments((prev) => prev.map((d) => (d.id === deptId ? { ...d, ...data } : d)));
      setAllowedLunchMinutesInput(
        data.allowedLunchMinutes != null ? String(data.allowedLunchMinutes) : "",
      );
      setAllowedBreaksMinutesInput(
        data.allowedBreaksMinutes != null ? String(data.allowedBreaksMinutes) : "",
      );
      toast.success("Allowed durations updated");
      setOtherSettingsOpen(false);
    } catch (e) {
      toast.error(extractApiMessage(e));
    }
  }

  useEffect(() => {
    if (overviewMode) return;
    if (!selectedTeam) return;
    if (selectedTeam === "__ALL_TEAMS__") return;
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
    if (!overviewMode && selectedTeam !== "__ALL_TEAMS__") return;
    void (async () => {
      const params = rangeMode ? { from, to } : { date };
      const { data } = await api.get<AttendanceOverviewGroupDto[]>(
        `/api/attendance/overview`,
        { params },
      );
      setOverview(data);
    })();
  }, [overviewMode, selectedTeam, rangeMode, date, from, to]);

  function exportCsv() {
    if (overviewMode) return;
    if (!selectedTeam) return;
    if (selectedTeam === ALL_TEAMS) return;
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

  const canExportAllDepartments = role === "SUPER_ADMIN" || role === "ADMIN";
  const canExportDepartment =
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "DEPT_MANAGER" ||
    role === "TEAM_LEADER";
  const canExportTeam =
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "DEPT_MANAGER" ||
    role === "TEAM_LEADER";

  function downloadBlob(blob: Blob, fallbackName: string, contentDisposition?: string | null) {
    let name = fallbackName;
    if (contentDisposition) {
      const m = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
      if (m?.[1]) name = m[1];
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  }

  async function exportExcel() {
    const deptId = selectedDeptId ?? departmentId ?? "";
    const groupedForExport = deptAllTeamsMode ? deptFilteredGrouped : grouped;
    const filterUserIds = Array.from(
      new Set(
        (showGroupedView ? groupedForExport.flatMap((g) => g.rows) : filteredRows).map(
          (r) => r.userId,
        ),
      ),
    );

    const body: Record<string, unknown> = {
      scope: exportScope,
      filterUserIds,
    };
    if (rangeMode) {
      body.from = from;
      body.to = to;
    } else {
      body.date = date;
    }
    if (exportScope === "TEAM") {
      if (!selectedTeam) return;
      if (selectedTeam === ALL_TEAMS) return;
      body.teamId = selectedTeam;
    } else if (exportScope === "DEPARTMENT") {
      if (!deptId) return;
      body.departmentId = deptId;
    }

    const res = await api.post<Blob>("/api/attendance/export.xlsx", body, {
      responseType: "blob",
    });
    downloadBlob(
      res.data,
      `attendance-${exportScope.toLowerCase()}-${rangeMode ? `${from}-to-${to}` : date}.xlsx`,
      (res.headers as Record<string, string | undefined>)["content-disposition"] ?? null,
    );
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

  const deptAllTeamsMode = !overviewMode && selectedTeam === ALL_TEAMS;
  const showGroupedView = overviewMode || deptAllTeamsMode;
  const deptFilteredGrouped = useMemo(() => {
    if (!deptAllTeamsMode) return grouped;
    const deptId = selectedDeptId ?? departmentId ?? null;
    if (!deptId) return [];
    return grouped.filter((g) => g.departmentId === deptId);
  }, [deptAllTeamsMode, grouped, selectedDeptId, departmentId]);

  useEffect(() => {
    if (!deptAllTeamsMode) return;
    setExportScope("DEPARTMENT");
  }, [deptAllTeamsMode]);

  const deptFirstStartHour = useMemo(() => {
    // Prefer configured business hour if present (single-team view has a selected department).
    const deptId = selectedDeptId ?? departmentId ?? null;
    if (!deptId) return null;
    const d = departments.find((x) => x.id === deptId);
    const h = d?.businessFirstStartHour;
    return typeof h === "number" ? clampHour(h) : null;
  }, [departments, selectedDeptId, departmentId]);

  const deptFirstStartHourByDeptId = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of departments) {
      if (typeof d.businessFirstStartHour === "number") {
        m.set(d.id, clampHour(d.businessFirstStartHour));
      }
    }
    return m;
  }, [departments]);

  function toastIfOverviewBlocksDeptTeam() {
    if (!overviewMode) return false;
    toast.info(t("attendance.uncheckOverviewForDeptTeamFilters"));
    setShowOverviewUncheckArrow(true);
    return true;
  }

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
            onChange={(e) => {
              if (toastIfOverviewBlocksDeptTeam()) return;
              void onDepartmentChange(e.target.value);
            }}
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
            onChange={(e) => {
              if (toastIfOverviewBlocksDeptTeam()) return;
              setSelectedTeam(e.target.value);
            }}
            className="ml-2 rounded border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value={ALL_TEAMS}>All teams</option>
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
        <span className="relative inline-flex items-center">
          {showOverviewUncheckArrow ? (
            <span
              className="attendance-overview-hint-arrow pointer-events-none absolute -top-[3.5rem] left-[5px] z-10 flex flex-col items-center sm:left-2"
              aria-hidden
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={3}
                stroke="currentColor"
                className="h-9 w-9 text-emerald-700 dark:text-emerald-300"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m0 0l-6-6m6 6l6-6"
                />
              </svg>
            </span>
          ) : null}
          <label className="text-sm">
            <input
              type="checkbox"
              className="mr-2 align-middle"
              checked={overviewMode}
              onChange={(e) => setOverviewMode(e.target.checked)}
            />
            {t("attendance.overview")}
          </label>
        </span>
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
        {canEditLateGrace && (selectedDeptId ?? departmentId) && (
          <div ref={otherSettingsRef} className="relative">
            <button
              type="button"
              aria-expanded={otherSettingsOpen}
              aria-haspopup="dialog"
              onClick={() => setOtherSettingsOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
                  otherSettingsOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
              {t("attendance.otherSettings")}
            </button>
            {otherSettingsOpen && (
            <div
              role="dialog"
              aria-label={t("attendance.otherSettings")}
              className="absolute left-0 z-30 mt-1 min-w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex flex-col gap-4 text-sm">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Grace (min)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={lateGraceMinutesInput}
                      onChange={(e) => setLateGraceMinutesInput(e.target.value)}
                      className="w-24 rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
                      placeholder="10"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveLateGraceMinutes()}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                  >
                    Save
                  </button>
                </div>
                <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Allowed lunch (min)
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={300}
                        value={allowedLunchMinutesInput}
                        onChange={(e) => setAllowedLunchMinutesInput(e.target.value)}
                        className="w-24 rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
                        placeholder="30"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Allowed breaks (min)
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={300}
                        value={allowedBreaksMinutesInput}
                        onChange={(e) => setAllowedBreaksMinutesInput(e.target.value)}
                        className="w-24 rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
                        placeholder="20"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveAllowedDurations()}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={exportCsv}
          disabled={overviewMode || !selectedTeam || selectedTeam === ALL_TEAMS}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
        >
          {t("action.exportCsv")}
        </button>
        <label className="text-sm">
          <span className="mr-2">Export</span>
          <select
            value={exportScope}
            onChange={(e) => setExportScope(e.target.value as "ALL" | "DEPARTMENT" | "TEAM")}
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
          >
            {canExportTeam && <option value="TEAM">Team</option>}
            {canExportDepartment && <option value="DEPARTMENT">Department</option>}
            {canExportAllDepartments && <option value="ALL">All departments</option>}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void exportExcel()}
          disabled={
            (exportScope === "TEAM" && (!selectedTeam || selectedTeam === ALL_TEAMS)) ||
            (exportScope === "DEPARTMENT" && !(selectedDeptId ?? departmentId)) ||
            (exportScope === "ALL" && !canExportAllDepartments)
          }
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
        >
          {t("action.exportExcel")}
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

      {!showGroupedView && (
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
                const manuallyOpen = openRow === rowKey;
                const expanded = expandAll || manuallyOpen;
                const punchesExpanded = openPunchTimes.has(rowKey);
                const startH = startHourForIndent(r);
                const minH = deptFirstStartHour;
                const indentPx =
                  startH != null && minH != null && startH > minH ? (startH - minH) * 20 : 0;
                return (
                  <tr
                    key={rowKey}
                    className={`border-t border-zinc-200 transition-colors dark:border-zinc-800 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 ${
                      rangeMode ? dayColorClass(r.recordDate) : ""
                    } ${
                      manuallyOpen || punchesExpanded
                        ? rangeMode
                          ? "ring-2 ring-inset ring-emerald-400/60"
                          : "bg-emerald-50/70 ring-2 ring-inset ring-emerald-400/50 dark:bg-emerald-950/20"
                        : ""
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
                              indentPx={indentPx}
                              showDurations={punchesExpanded || expandAllPunchTimes}
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

      {showGroupedView && (
        <div className="space-y-3">
          {(deptAllTeamsMode ? deptFilteredGrouped : grouped).map((g) => (
            <div
              key={g.teamId}
              className={`overflow-x-auto rounded-lg border ${teamAccentClass(g.teamId)}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 bg-white/40 px-3 py-2 dark:bg-black/10">
                <div className="font-medium">
                  {deptAllTeamsMode ? g.teamName : `${g.departmentName} / ${g.teamName}`}
                </div>
                <div className="text-xs text-zinc-500">
                  {g.rows.length} employee{g.rows.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="border-t border-zinc-200 bg-white/40 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-black/5 dark:text-zinc-300">
                {t("table.teamLeader")}:{" "}
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
                    const manuallyOpen = openRow === rowKey;
                    const expanded = expandAll || manuallyOpen;
                    const punchesExpanded = openPunchTimes.has(rowKey);
                    const startH = startHourForIndent(r);
                    const minH =
                      deptFirstStartHourByDeptId.get(g.departmentId) ??
                      deptFirstStartHour ??
                      null;
                    const indentPx =
                      startH != null && minH != null && startH > minH ? (startH - minH) * 20 : 0;
                    return (
                    <tr
                      key={rowKey}
                      className={`border-t border-zinc-200 transition-colors dark:border-zinc-800 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 ${
                        rangeMode ? dayColorClass(r.recordDate) : ""
                      } ${
                        manuallyOpen || punchesExpanded
                          ? rangeMode
                            ? "ring-2 ring-inset ring-emerald-400/60"
                            : "bg-emerald-50/70 ring-2 ring-inset ring-emerald-400/50 dark:bg-emerald-950/20"
                          : ""
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
                              indentPx={indentPx}
                          showDurations={punchesExpanded || expandAllPunchTimes}
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
          {(deptAllTeamsMode ? deptFilteredGrouped : grouped).length === 0 && (
            <p className="text-sm text-zinc-500">{t("attendance.noMatches")}</p>
          )}
        </div>
      )}
    </div>
  );
}
