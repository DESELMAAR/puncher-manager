"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/lib/types";
import { CompanyHeader } from "@/components/company/CompanyHeader";

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

  const visible = links.filter((l) => role && l.roles.includes(role));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="fixed inset-y-0 left-0 w-56 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <div className="text-lg font-semibold">Puncher Manager</div>
          <div className="truncate text-xs text-zinc-500">{name}</div>
          <div className="text-xs text-zinc-400">{role}</div>
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
          <CompanyHeader />
          {children}
        </div>
      </main>
    </div>
  );
}
