"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AttendanceRow, DepartmentDto, TeamDto } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

export default function TeamPage() {
  const { teamId, departmentId, role } = useAuthStore();
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  useEffect(() => {
    void (async () => {
      if (role === "TEAM_LEADER" && teamId) {
        setSelectedTeam(teamId);
        setTeams([{ id: teamId, name: "My team" }]);
        return;
      }
      let deptId = departmentId;
      if ((role === "SUPER_ADMIN" || role === "ADMIN") && !deptId) {
        const { data: depts } = await api.get<DepartmentDto[]>("/api/departments");
        deptId = depts[0]?.id ?? null;
      }
      if (deptId) {
        const { data } = await api.get<TeamDto[]>(`/api/teams/department/${deptId}`);
        setTeams(data.map((t) => ({ id: t.id, name: t.name })));
        if (data[0]) setSelectedTeam(data[0].id);
      }
    })();
  }, [role, teamId, departmentId]);

  useEffect(() => {
    if (!selectedTeam) return;
    void (async () => {
      const { data } = await api.get<AttendanceRow[]>(`/api/attendance/team/${selectedTeam}`, {
        params: { date },
      });
      setRows(data);
    })();
  }, [selectedTeam, date]);

  function exportCsv() {
    if (!selectedTeam) return;
    const baseURL =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";
    const tok = useAuthStore.getState().token;
    const url = `${baseURL}/api/attendance/team/${selectedTeam}/export?date=${date}`;
    void fetch(url, { headers: { Authorization: `Bearer ${tok}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `attendance-${date}.csv`;
        a.click();
      })
      .catch(() => window.open(url, "_blank", "noopener"));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Team attendance</h1>
      {teams.length > 1 && (
        <label className="text-sm">
          Team{" "}
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
      {teams.length === 0 && (
        <p className="text-sm text-zinc-500">No teams available for your scope.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Date{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
          />
        </label>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
        >
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="p-2">Employee</th>
              <th className="p-2">Status</th>
              <th className="p-2">Punches</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="p-2">
                  {r.name}
                  <div className="font-mono text-xs text-zinc-500">{r.employeeId}</div>
                </td>
                <td className="p-2">{r.status ?? "—"}</td>
                <td className="p-2 text-xs">
                  {r.punches?.map((p) => p.type).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
