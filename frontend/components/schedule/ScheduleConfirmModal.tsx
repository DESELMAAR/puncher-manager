"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ModalScrim } from "@/components/ModalScrim";
import { api } from "@/lib/api";
import { extractApiMessage } from "@/lib/errors";
import type { WeeklyScheduleDayDto, WeeklyScheduleResponse } from "@/lib/types";

const DOW_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function hhmm(v: string | null) {
  if (!v) return "";
  return v.slice(0, 5);
}

export function ScheduleConfirmModal({
  open,
  notificationId,
  schedule,
  onClose,
  onConfirmed,
}: {
  open: boolean;
  notificationId: string;
  schedule: WeeklyScheduleResponse;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const days = useMemo(() => {
    return (schedule.days || [])
      .slice()
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }, [schedule.days]);

  async function markRead() {
    await api.patch(`/api/notification/${notificationId}/read`);
  }

  async function respond(status: "CONFIRMED" | "CORRECTION_REQUESTED") {
    if (!schedule.scheduleId) return;
    setSubmitting(true);
    try {
      await api.post(`/api/schedules/${schedule.scheduleId}/respond`, {
        status,
        comment: comment.trim() || null,
      });
      await markRead();
      toast.success(status === "CONFIRMED" ? "Schedule confirmed" : "Correction requested");
      onConfirmed();
      onClose();
    } catch (e) {
      toast.error(extractApiMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <ModalScrim
      onDismiss={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm"
    >
      <div className="relative z-[121] w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Confirm your weekly schedule
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Week starting <span className="font-mono">{schedule.weekStart}</span> (Sunday → Saturday)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-950/50">
              <tr>
                <th className="px-4 py-2 font-semibold">Day</th>
                <th className="px-4 py-2 font-semibold">Plan</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d: WeeklyScheduleDayDto) => (
                <tr key={d.dayOfWeek} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2 font-medium">{DOW_LABELS[d.dayOfWeek]}</td>
                  <td className="px-4 py-2">
                    {d.dayOff ? (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                        Day off
                      </span>
                    ) : (
                      <span className="font-mono">
                        {hhmm(d.startTime)} → {hhmm(d.endTime)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="mt-4 block text-sm font-medium">
          Comment (optional)
          <textarea
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="If something is wrong, explain what needs correction…"
          />
        </label>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={submitting}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700 disabled:opacity-50"
            onClick={() => void respond("CORRECTION_REQUESTED")}
          >
            Ask for correction
          </button>
          <button
            type="button"
            disabled={submitting}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void respond("CONFIRMED")}
          >
            Confirm
          </button>
        </div>
      </div>
    </ModalScrim>
  );
}

