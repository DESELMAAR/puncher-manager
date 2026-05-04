"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import type { NotificationDto, UserRole } from "@/lib/types";
import { CompanyHeader } from "@/components/company/CompanyHeader";
import { useUiStore, type BackgroundTheme } from "@/store/uiStore";
import { useI18nStore } from "@/store/i18nStore";
import { t } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { CompanySettingsDto } from "@/lib/types";

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
      return "bg-[rgb(211,218,217)] dark:bg-[#44444E]";
  }
}

const links: { href: string; labelKey: I18nKey; roles: UserRole[] }[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER", "EMPLOYEE"] },
  { href: "/punch", labelKey: "nav.punch", roles: ["EMPLOYEE"] },
  { href: "/history", labelKey: "nav.myPunches", roles: ["EMPLOYEE"] },
  { href: "/notifications", labelKey: "nav.notifications", roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER", "EMPLOYEE"] },
  { href: "/team", labelKey: "nav.teamAttendance", roles: ["TEAM_LEADER", "DEPT_MANAGER", "SUPER_ADMIN", "ADMIN"] },
  {
    href: "/admin/schedule",
    labelKey: "nav.weeklySchedule",
    roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER"],
  },
  {
    href: "/admin/departments",
    labelKey: "nav.departments",
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    href: "/admin/teams",
    labelKey: "nav.teams",
    roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER"],
  },
  {
    href: "/admin/organization",
    labelKey: "nav.staffRoles",
    roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER"],
  },
  {
    href: "/admin/employees",
    labelKey: "nav.employees",
    roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER"],
  },
  {
    href: "/admin/settings",
    labelKey: "nav.settings",
    roles: ["SUPER_ADMIN"],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, name, clear, token } = useAuthStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const backgroundTheme = useUiStore((s) => s.backgroundTheme);
  const lang = useI18nStore((s) => s.lang);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const visible = links.filter((l) => role && l.roles.includes(role));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<CompanySettingsDto>("/api/settings/company");
        const url = data?.backgroundImageUrl?.trim() || null;
        if (!cancelled) setBgUrl(url);
      } catch {
        if (!cancelled) setBgUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadUnread(silent?: boolean) {
      try {
        const { data } = await api.get<NotificationDto[]>("/api/notification/my", {
          skipGlobalLoading: silent,
        });
        const c = data.filter((n) => !n.read).length;
        if (!cancelled) setUnreadCount(c);
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    }

    void loadUnread();
    const interval = window.setInterval(() => void loadUnread(true), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshKey, pathname]);

  useEffect(() => {
    if (!token) return;
    const baseURL =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";
    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: number | undefined;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      es?.close();
      const url = `${baseURL}/api/notification/stream?access_token=${encodeURIComponent(token)}`;
      es = new EventSource(url);
      es.addEventListener("open", () => {
        attempt = 0;
      });
      es.addEventListener("notification", () => {
        setUnreadCount((c) => c + 1);
      });
      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        const delay = Math.min(60_000, 1000 * 2 ** Math.min(attempt, 8));
        attempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [token]);

  return (
    <div
      className={`min-h-screen text-zinc-900 dark:text-zinc-200 ${backgroundClass(backgroundTheme)}`}
      style={
        bgUrl
          ? {
              backgroundImage: `url(${bgUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
            }
          : undefined
      }
    >
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
              <span className="flex items-center justify-between gap-3">
                <span>{t(lang, l.labelKey)}</span>
                {l.href === "/notifications" && unreadCount > 0 && (
                  <span
                    className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white"
                    aria-label={`${unreadCount} unread notifications`}
                    title={`${unreadCount} unread`}
                  >
                    {unreadCount}
                  </span>
                )}
              </span>
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
            {t(lang, "action.logout")}
          </button>
        </div>
      </aside>
      <main className="pl-56">
        <div
          className={`mx-auto p-6 ${pathname?.startsWith("/admin") ? "max-w-screen-2xl" : "max-w-screen-2xl"}`}
        >
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                // Many pages fetch via `useEffect`; remounting forces those effects to run again.
                setRefreshKey((k) => k + 1);
                router.refresh();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              title={t(lang, "action.refresh")}
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
              {t(lang, "action.refresh")}
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
