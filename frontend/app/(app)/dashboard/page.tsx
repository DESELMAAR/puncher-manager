"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const { name, role, employeeId, teamId, departmentId } = useAuthStore();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Welcome, {name}. You are signed in as <strong>{role}</strong>.
      </p>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <dt className="text-xs uppercase text-zinc-500">Employee ID</dt>
          <dd className="font-mono text-lg">{employeeId}</dd>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <dt className="text-xs uppercase text-zinc-500">Department / Team</dt>
          <dd className="text-sm">
            {departmentId ? <span className="font-mono">{departmentId.slice(0, 8)}…</span> : "—"}
            {" · "}
            {teamId ? <span className="font-mono">{teamId.slice(0, 8)}…</span> : "—"}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-3">
        {role === "EMPLOYEE" && (
          <>
            <Link
              href="/punch"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
            >
              Go to Punch
            </Link>
            <Link href="/history" className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600">
              Punch history
            </Link>
          </>
        )}
        {(role === "TEAM_LEADER" || role === "DEPT_MANAGER" || role === "SUPER_ADMIN" || role === "ADMIN") && (
          <Link href="/team" className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">
            Team attendance
          </Link>
        )}
        <Link href="/notifications" className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600">
          Notifications
        </Link>
      </div>
    </div>
  );
}
