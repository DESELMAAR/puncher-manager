"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/lib/types";
import { CompanyHeader } from "@/components/company/CompanyHeader";
import { useUiStore, type BackgroundTheme } from "@/store/uiStore";

function backgroundClass(t: BackgroundTheme) {
  switch (t) {
    case "ROSE":
      return "bg-rose-50 dark:bg-rose-950/40";
    case "OCEAN":
      return "bg-sky-50 dark:bg-sky-950/40";
    case "FOREST":
      return "bg-emerald-50 dark:bg-emerald-950/35";
    case "SUNSET":
      return "bg-amber-50 dark:bg-amber-950/35";
    case "VIOLET":
      return "bg-violet-50 dark:bg-violet-950/35";
    case "DEFAULT":
    default:
      return "bg-zinc-50 dark:bg-zinc-950";
  }
}

const links: { href: string; label: string; roles: UserRole[] }[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER", "EMPLOYEE"] },
  { href: "/punch", label: "Punch", roles: ["EMPLOYEE"] },
  { href: "/history", label: "My punches", roles: ["EMPLOYEE"] },
  { href: "/notifications", label: "Notifications", roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER", "EMPLOYEE"] },
  { href: "/team", label: "Team attendance", roles: ["TEAM_LEADER", "DEPT_MANAGER", "SUPER_ADMIN", "ADMIN"] },
  {
    href: "/admin/schedule",
    label: "Weekly schedule",
    roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER"],
  },
  {
    href: "/admin/departments",
    label: "Departments",
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    href: "/admin/teams",
    label: "Teams",
    roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER"],
  },
  {
    href: "/admin/organization",
    label: "Staff & roles",
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    href: "/admin/employees",
    label: "Employees",
    roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER"],
  },
  {
    href: "/admin/settings",
    label: "Settings",
    roles: ["SUPER_ADMIN"],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, name, clear } = useAuthStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const backgroundTheme = useUiStore((s) => s.backgroundTheme);
  const setBackgroundTheme = useUiStore((s) => s.setBackgroundTheme);

  const visible = links.filter((l) => role && l.roles.includes(role));

  return (
    <div
      className={`min-h-screen text-zinc-900 dark:text-zinc-100 ${backgroundClass(backgroundTheme)}`}
    >
      <aside className="fixed inset-y-0 left-0 w-56 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <div className="text-lg font-semibold">Puncher Manager</div>
          <div className="truncate text-xs text-zinc-500">{name}</div>
          <div className="text-xs text-zinc-400">{role}</div>
          <div className="mt-3">
            <label className="text-[11px] font-medium text-zinc-500">Background</label>
            <select
              value={backgroundTheme}
              onChange={(e) => setBackgroundTheme(e.target.value as BackgroundTheme)}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="DEFAULT">Default</option>
              <option value="ROSE">Rose</option>
              <option value="OCEAN">Ocean</option>
              <option value="FOREST">Forest</option>
              <option value="SUNSET">Sunset</option>
              <option value="VIOLET">Violet</option>
            </select>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {visible.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-sm ${
                pathname === l.href
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-zinc-200 p-2 dark:border-zinc-800">
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => {
              clear();
              router.push("/login");
            }}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="pl-56">
        <div
          className={`mx-auto p-6 ${pathname?.startsWith("/admin") ? "max-w-7xl" : "max-w-5xl"}`}
        >
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                // Most pages fetch data in client effects; remount to refetch without browser reload.
                setRefreshKey((k) => k + 1);
                router.refresh();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              title="Refresh"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              Refresh
            </button>
          </div>
          <div key={refreshKey}>
            <CompanyHeader />
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
