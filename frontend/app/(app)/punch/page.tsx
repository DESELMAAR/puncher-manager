"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PunchDto, PunchType } from "@/lib/types";
import { labelPunch, nextExpectedPunch } from "@/lib/punchSequence";
import { ActiveStatusTimer } from "@/components/punch/ActiveStatusTimer";
import { formatDurationMs } from "@/lib/time";
import { localDateISO } from "@/lib/dateUtils";

export default function PunchPage() {
  const [punches, setPunches] = useState<PunchDto[]>([]);
  const [next, setNext] = useState<PunchType | null>("WORK_START");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (silent?: boolean) => {
    const day = localDateISO();
    const { data } = await api.get<PunchDto[]>("/api/punch/my-history", {
      params: { from: day, to: day },
      skipGlobalLoading: silent,
    });
    setPunches(data);
    setNext(nextExpectedPunch(data));
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(true), 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function punch(type: PunchType) {
    setMsg(null);
    setLoading(true);
    try {
      await api.post("/api/punch", { type, timestamp: new Date().toISOString() });
      await refresh(true);
    } catch (e: unknown) {
      const m =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Punch failed";
      setMsg(m);
    } finally {
      setLoading(false);
    }
  }

  function resolveWorkPunchType(): PunchType {
    if (next === "WORK_START") return "WORK_START";
    if (next === "BREAK1_END") return "BREAK1_END";
    if (next === "LUNCH_END") return "LUNCH_END";
    if (next === "BREAK2_END") return "BREAK2_END";
    // Allow switching to work at any time
    return "WORK_START";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Punch</h1>
      <p className="text-sm text-zinc-500">
        Today ({localDateISO()}). Only the next action in sequence is enabled.
      </p>
      <ActiveStatusTimer punches={punches} />
      {msg && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40">{msg}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => punch(resolveWorkPunchType())}
          className="rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-4 text-left text-sm font-medium text-emerald-900 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/60"
        >
          Work
          <div className="mt-1 text-xs font-normal text-emerald-700/90 dark:text-emerald-200/90">
            Starts work or ends break/lunch
          </div>
        </button>

        {(["BREAK1_START", "LUNCH_START", "BREAK2_START", "LOGOUT"] as PunchType[]).map((t) => {
          const active = next === t;
          return (
            <button
              key={t}
              type="button"
              disabled={!active || loading}
              onClick={() => punch(t)}
              className={`rounded-xl border px-4 py-4 text-left text-sm font-medium transition ${
                active
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : "cursor-not-allowed border-zinc-200 opacity-50 dark:border-zinc-800"
              }`}
            >
              {labelPunch(t)}
            </button>
          );
        })}
      </div>
      <div>
        <h2 className="mb-2 font-semibold">Today&apos;s log</h2>
        <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          {[...punches]
            .sort((a, b) => new Date(a.punchedAt).getTime() - new Date(b.punchedAt).getTime())
            .map((p, idx, arr) => {
              const t0 = new Date(p.punchedAt).getTime();
              const t1 = arr[idx + 1] ? new Date(arr[idx + 1]!.punchedAt).getTime() : Date.now();
              const closed = !!arr[idx + 1];
              const dur = formatDurationMs(Math.max(0, t1 - t0));
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-mono">{p.type}</span> —{" "}
                    {new Date(p.punchedAt).toLocaleTimeString()}
                  </span>
                  <span className="font-mono text-xs text-zinc-500">
                    {closed ? `+ ${dur}` : `running ${dur}`}
                  </span>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}
