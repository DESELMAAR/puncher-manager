"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PunchDto } from "@/lib/types";
import { localDateISO } from "@/lib/dateUtils";

function dayTintClass(isoDate: string) {
  // Stable background per day to visually group punches.
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

export default function HistoryPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return localDateISO(d);
  });
  const [to, setTo] = useState(() => localDateISO());
  const [rows, setRows] = useState<PunchDto[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await api.get<PunchDto[]>("/api/punch/my-history", {
        params: { from, to },
      });
      setRows(data);
    })();
  }, [from, to]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My punch history</h1>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          From{" "}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ml-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
          />
        </label>
        <label className="text-sm">
          To{" "}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
          />
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="p-2">Type</th>
              <th className="p-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, idx) => {
              const d = new Date(p.punchedAt);
              const day = localDateISO(d);
              const prevDay = idx > 0 ? localDateISO(new Date(rows[idx - 1]!.punchedAt)) : null;
              const isNewDay = day !== prevDay;
              const tint = dayTintClass(day);
              return (
                <Fragment key={p.id}>
                  {isNewDay && (
                    <tr
                      className={`border-t border-zinc-200 dark:border-zinc-800 ${tint}`}
                      key={`${day}-header`}
                    >
                      <td
                        colSpan={2}
                        className="px-2 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200"
                      >
                        {new Date(day).toLocaleDateString()}
                      </td>
                    </tr>
                  )}
                  <tr
                    className={`border-t border-zinc-200 dark:border-zinc-800 ${tint}`}
                  >
                    <td className="p-2 font-mono text-xs">{p.type}</td>
                    <td className="p-2">{d.toLocaleString()}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
