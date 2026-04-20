"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PunchDto, PunchType } from "@/lib/types";
import { labelPunch, nextExpectedPunch, PUNCH_ORDER } from "@/lib/punchSequence";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function PunchPage() {
  const [punches, setPunches] = useState<PunchDto[]>([]);
  const [next, setNext] = useState<PunchType | null>("WORK_START");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const day = todayISO();
    const { data } = await api.get<PunchDto[]>("/api/punch/my-history", {
      params: { from: day, to: day },
    });
    setPunches(data);
    setNext(nextExpectedPunch(data));
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function punch(type: PunchType) {
    setMsg(null);
    setLoading(true);
    try {
      await api.post("/api/punch", { type, timestamp: new Date().toISOString() });
      await refresh();
    } catch (e: unknown) {
      const m =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Punch failed";
      setMsg(m);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Punch</h1>
      <p className="text-sm text-zinc-500">
        Today ({todayISO()}). Only the next action in sequence is enabled.
      </p>
      {msg && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40">{msg}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {PUNCH_ORDER.map((t) => {
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
      {next === null && (
        <p className="text-emerald-600 dark:text-emerald-400">Shift completed for today.</p>
      )}
      <div>
        <h2 className="mb-2 font-semibold">Today&apos;s log</h2>
        <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          {punches.map((p) => (
            <li key={p.id}>
              {p.type} — {new Date(p.punchedAt).toLocaleTimeString()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
