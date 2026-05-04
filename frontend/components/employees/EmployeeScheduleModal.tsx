"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { extractApiMessage } from "@/lib/errors";
import type { UserDto, UserRole, WeeklyScheduleDayDto, WeeklyScheduleResponse } from "@/lib/types";
import { localDateISO, normalizeWeekStartSunday } from "@/lib/dateUtils";
import { useAuthStore } from "@/store/authStore";

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Gap between tooltip and arrow: 2px below, 2px to the right of the arrow. */
const ARROW_GAP = 2;
const VIEW_MARGIN = 8;

export type SchedulePopoverAnchor = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function hhmm(v: string | null) {
  if (!v) return "";
  return v.slice(0, 5);
}

function canManageWeeklySchedule(role: UserRole | null): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "DEPT_MANAGER" ||
    role === "TEAM_LEADER"
  );
}

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

function cloneDaysForEdit(s: WeeklyScheduleResponse): WeeklyScheduleDayDto[] {
  if (s.days?.length === 7) {
    return s.days.map((d) => ({ ...d }));
  }
  return defaultWeek();
}

function confirmationBadge(status: WeeklyScheduleResponse["confirmationStatus"]) {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100";
    case "CORRECTION_REQUESTED":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100";
    default:
      return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";
  }
}

/** Tooltip below the arrow by {@link ARROW_GAP}px, to the right of the arrow with {@link ARROW_GAP}px between them; flips above / left if needed. */
function computePlacement(
  panelW: number,
  panelH: number,
  anchor: SchedulePopoverAnchor,
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = anchor.top + anchor.height + ARROW_GAP;
  if (top + panelH > vh - VIEW_MARGIN) {
    top = anchor.top - panelH - ARROW_GAP;
  }
  top = Math.max(VIEW_MARGIN, Math.min(top, vh - panelH - VIEW_MARGIN));

  let left = anchor.left + anchor.width + ARROW_GAP;
  if (left + panelW > vw - VIEW_MARGIN) {
    left = anchor.left - panelW - ARROW_GAP;
  }
  left = Math.max(VIEW_MARGIN, Math.min(left, vw - panelW - VIEW_MARGIN));

  return { top, left };
}

export function EmployeeScheduleModal({
  user,
  anchor,
  onClose,
}: {
  user: UserDto;
  anchor: SchedulePopoverAnchor;
  onClose: () => void;
}) {
  const role = useAuthStore((s) => s.role) as UserRole | null;
  const canEdit = canManageWeeklySchedule(role);

  const panelRef = useRef<HTMLDivElement>(null);
  const [weekStart, setWeekStart] = useState(() => normalizeWeekStartSunday(localDateISO()));
  const [schedule, setSchedule] = useState<WeeklyScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editDays, setEditDays] = useState<WeeklyScheduleDayDto[]>(() => defaultWeek());
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    function onDocPointer(ev: PointerEvent) {
      if (editing) return;
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (t.closest("[data-schedule-trigger]")) return;
      if (panelRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("pointerdown", onDocPointer, true);
    return () => document.removeEventListener("pointerdown", onDocPointer, true);
  }, [onClose, editing]);

  useEffect(() => {
    function onScroll() {
      if (editing) return;
      onClose();
    }
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [onClose, editing]);

  useLayoutEffect(() => {
    const apply = () => {
      const el = panelRef.current;
      if (!el) return;
      el.style.transform = "none";
      const rect = el.getBoundingClientRect();
      const { top, left } = computePlacement(rect.width, rect.height, anchor);
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [
    anchor.top,
    anchor.left,
    anchor.width,
    anchor.height,
    user.id,
    weekStart,
    schedule,
    loading,
    editing,
    saving,
    sending,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSchedule(null);
    void (async () => {
      try {
        const { data } = await api.get<WeeklyScheduleResponse>("/api/schedules/week", {
          params: { employeeId: user.id, weekStart },
        });
        if (!cancelled) setSchedule(data);
      } catch (e) {
        if (!cancelled) {
          toast.error(extractApiMessage(e));
          setSchedule(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id, weekStart]);

  useEffect(() => {
    setEditing(false);
  }, [weekStart, user.id]);

  async function saveSchedule() {
    if (!schedule) return;
    setSaving(true);
    try {
      const { data } = await api.put<WeeklyScheduleResponse>("/api/schedules/week", {
        employeeId: user.id,
        weekStart,
        days: editDays,
      });
      setSchedule(data);
      setEditDays(cloneDaysForEdit(data));
      setEditing(false);
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

  function startEditing() {
    if (!schedule) return;
    setEditDays(cloneDaysForEdit(schedule));
    setEditing(true);
  }

  const days = useMemo(() => {
    if (!schedule?.days?.length) return [];
    return schedule.days.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }, [schedule]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Weekly schedule"
      style={{ position: "fixed" }}
      className={`z-[115] max-h-[min(80vh,32rem)] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-xl ring-1 ring-black/5 dark:border-zinc-600 dark:bg-zinc-900 dark:ring-white/10 ${
        editing ? "w-[min(26rem,calc(100vw-1rem))]" : "w-[min(18rem,calc(100vw-1.5rem))]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-900 dark:text-white">Schedule</p>
          <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            {user.name}{" "}
            <span className="font-mono text-[10px]">({user.employeeId})</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canEdit && schedule && !loading && !editing ? (
            <button
              type="button"
              onClick={() => startEditing()}
              className="rounded-md border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Modify
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-400">
          Week
          <input
            type="date"
            value={weekStart}
            disabled={editing}
            onChange={(e) => setWeekStart(normalizeWeekStartSunday(e.target.value))}
            className="max-w-[10.5rem] rounded border border-zinc-300 px-1.5 py-0.5 font-mono text-[11px] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        {schedule ? (
          <span
            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${confirmationBadge(schedule.confirmationStatus)}`}
          >
            {schedule.confirmationStatus.replace(/_/g, " ")}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 text-[11px] text-zinc-500">Loading…</p>
      ) : !schedule ? (
        <p className="mt-3 text-[11px] text-zinc-600 dark:text-zinc-400">Could not load.</p>
      ) : editing ? (
        <>
          <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
            <table className="w-full border-collapse text-[11px]">
              <thead className="border-b border-zinc-100 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                <tr>
                  <th className="px-1.5 py-1 text-left font-medium">Day</th>
                  <th className="px-1 py-1 text-center font-medium">Off</th>
                  <th className="px-1 py-1 text-left font-medium">Start</th>
                  <th className="px-1 py-1 text-left font-medium">End</th>
                </tr>
              </thead>
              <tbody>
                {editDays
                  .slice()
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                  .map((d) => (
                    <tr key={d.dayOfWeek} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-1.5 py-1 font-medium text-zinc-700 dark:text-zinc-300">
                        {DOW_SHORT[d.dayOfWeek]}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={d.dayOff}
                          className="h-3.5 w-3.5 accent-emerald-600"
                          onChange={(e) =>
                            setEditDays((prev) =>
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
                      <td className="px-1 py-0.5">
                        <input
                          type="time"
                          className="w-full min-w-0 rounded border border-zinc-300 px-1 py-0.5 font-mono text-[10px] dark:border-zinc-600 dark:bg-zinc-950"
                          disabled={d.dayOff}
                          value={fromTimeHHmmss(d.startTime)}
                          onChange={(e) => {
                            const v = toTimeHHmmss(e.target.value);
                            setEditDays((prev) =>
                              prev.map((x) =>
                                x.dayOfWeek !== d.dayOfWeek ? x : { ...x, startTime: v },
                              ),
                            );
                          }}
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <input
                          type="time"
                          className="w-full min-w-0 rounded border border-zinc-300 px-1 py-0.5 font-mono text-[10px] dark:border-zinc-600 dark:bg-zinc-950"
                          disabled={d.dayOff}
                          value={fromTimeHHmmss(d.endTime)}
                          onChange={(e) => {
                            const v = toTimeHHmmss(e.target.value);
                            setEditDays((prev) =>
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSchedule()}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-zinc-500">
            Save stores this week for this employee. After saving, use Send confirmation in this panel
            when you want the employee to confirm.
          </p>
        </>
      ) : (
        <>
          <table className="mt-2 w-full border-collapse text-[11px]">
            <tbody>
              {days.map((d: WeeklyScheduleDayDto) => (
                <tr key={d.dayOfWeek} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1 pr-2 font-medium text-zinc-700 dark:text-zinc-300">
                    {DOW_SHORT[d.dayOfWeek]}
                  </td>
                  <td className="py-1 text-zinc-600 dark:text-zinc-400">
                    {d.dayOff ? (
                      <span className="text-zinc-400">Off</span>
                    ) : (
                      <span className="font-mono tabular-nums">
                        {hhmm(d.startTime)}–{hhmm(d.endTime)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canEdit && schedule.scheduleId ? (
              <button
                type="button"
                disabled={sending}
                onClick={() => void sendConfirmation()}
                className="rounded-md border border-zinc-300 px-2.5 py-1 text-[11px] font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
              >
                {sending ? "Sending…" : "Send confirmation"}
              </button>
            ) : null}
          </div>
          {!schedule.scheduleId && (
            <p className="mt-2 text-[10px] leading-snug text-zinc-500">
              {canEdit
                ? "No saved week for this date — click Modify to set shifts and save."
                : "No saved week yet — use Weekly schedule to publish."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
