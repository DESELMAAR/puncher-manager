"use client";

import { useEffect, useMemo, useState } from "react";
import type { PunchDto } from "@/lib/types";
import { labelStatus, resolveActiveStatus } from "@/lib/punchSequence";
import { formatDurationMs } from "@/lib/time";

export function ActiveStatusTimer({ punches }: { punches: PunchDto[] }) {
  const status = useMemo(() => resolveActiveStatus(punches), [punches]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sinceIso = status.kind === "NOT_STARTED" ? null : status.since;
  const since = sinceIso ? new Date(sinceIso).getTime() : null;
  const elapsedMs = since ? now - since : 0;
  const running =
    status.kind !== "NOT_STARTED" && status.kind !== "SHIFT_ENDED";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Current status
          </div>
          <div className="mt-1 text-lg font-semibold">{labelStatus(status)}</div>
          {sinceIso && (
            <div className="mt-1 text-xs text-zinc-500">
              Since {new Date(sinceIso).toLocaleTimeString()}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {running ? "Elapsed" : "Duration"}
          </div>
          <div className="mt-1 font-mono text-2xl tabular-nums">
            {since ? formatDurationMs(elapsedMs) : "0:00:00"}
          </div>
        </div>
      </div>
      {!running && status.kind !== "NOT_STARTED" && (
        <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Shift is finished for today.
        </div>
      )}
    </div>
  );
}

