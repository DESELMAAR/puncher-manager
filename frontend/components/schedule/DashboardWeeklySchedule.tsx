"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WeeklyScheduleResponse } from "@/lib/types";
import { extractApiMessage } from "@/lib/errors";
import { toast } from "sonner";
import { localDateISO, normalizeWeekStartSunday } from "@/lib/dateUtils";

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHm(t: string | null) {
  if (!t) return "—";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function weekRangeLabel(weekStart: string) {
  const start = new Date(weekStart + "T12:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, o)} – ${end.toLocaleDateString(undefined, o)}`;
}

export function DashboardWeeklySchedule() {
  const [schedule, setSchedule] = useState<WeeklyScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const weekStart = normalizeWeekStartSunday(localDateISO());
        const { data } = await api.get<WeeklyScheduleResponse>("/api/schedules/week", {
          params: { weekStart },
        });
        setSchedule(data);
      } catch (e) {
        toast.error(extractApiMessage(e));
        setSchedule(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">Loading weekly schedule…</p>
      </div>
    );
  }

  const days =
    schedule?.days?.length === 7
      ? [...schedule.days].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      : [];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">This week&apos;s schedule</h2>
        {schedule?.weekStart && (
          <span className="text-xs text-zinc-500">{weekRangeLabel(schedule.weekStart)}</span>
        )}
      </div>
      {schedule?.confirmationStatus && (
        <p className="mb-3 text-xs text-zinc-500">
          Confirmation:{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {schedule.confirmationStatus === "CONFIRMED" && "Confirmed"}
            {schedule.confirmationStatus === "PENDING" && "Pending"}
            {schedule.confirmationStatus === "CORRECTION_REQUESTED" && "Correction requested"}
          </span>
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="py-1.5 pr-3 font-medium text-zinc-500">Day</th>
              <th className="py-1.5 font-medium text-zinc-500">Shift</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.dayOfWeek} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                  {DOW_SHORT[d.dayOfWeek] ?? d.dayOfWeek}
                </td>
                <td className="py-2 font-mono text-xs">
                  {d.dayOff ? (
                    <span className="text-zinc-500">Off</span>
                  ) : (
                    <>
                      {formatHm(d.startTime)} – {formatHm(d.endTime)}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
