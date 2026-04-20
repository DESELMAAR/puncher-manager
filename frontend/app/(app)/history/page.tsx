"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PunchDto } from "@/lib/types";

export default function HistoryPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
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
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="p-2 font-mono text-xs">{p.type}</td>
                <td className="p-2">{new Date(p.punchedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
