"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import type { NotificationDto, UserRole } from "@/lib/types";
import { CompanyHeader } from "@/components/company/CompanyHeader";
import { backgroundShellClass } from "@/lib/backgroundTheme";
import { useUiStore } from "@/store/uiStore";
import { useI18nStore } from "@/store/i18nStore";
import { t } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { CompanySettingsDto } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

const links: { href: string; labelKey: I18nKey; roles: UserRole[]; icon: "dashboard" | "punch" | "history" | "bell" | "users" | "chart" | "calendar" | "building" | "groups" | "badge" | "settings" }[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER", "EMPLOYEE"], icon: "dashboard" },
  { href: "/punch", labelKey: "nav.punch", roles: ["EMPLOYEE"], icon: "punch" },
  { href: "/history", labelKey: "nav.myPunches", roles: ["EMPLOYEE"], icon: "history" },
  { href: "/notifications", labelKey: "nav.notifications", roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER", "EMPLOYEE"], icon: "bell" },
  { href: "/team", labelKey: "nav.teamAttendance", roles: ["TEAM_LEADER", "DEPT_MANAGER", "SUPER_ADMIN", "ADMIN"], icon: "users" },
  { href: "/analytics", labelKey: "nav.analytics", roles: ["TEAM_LEADER", "DEPT_MANAGER", "SUPER_ADMIN", "ADMIN"], icon: "chart" },
  { href: "/admin/schedule", labelKey: "nav.weeklySchedule", roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER"], icon: "calendar" },
  { href: "/admin/departments", labelKey: "nav.departments", roles: ["SUPER_ADMIN", "ADMIN"], icon: "building" },
  { href: "/admin/teams", labelKey: "nav.teams", roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER"], icon: "groups" },
  { href: "/admin/organization", labelKey: "nav.staffRoles", roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER"], icon: "badge" },
  { href: "/admin/employees", labelKey: "nav.employees", roles: ["SUPER_ADMIN", "ADMIN", "DEPT_MANAGER", "TEAM_LEADER"], icon: "users" },
  { href: "/admin/settings", labelKey: "nav.settings", roles: ["SUPER_ADMIN"], icon: "settings" },
];

function NavIcon({ name }: { name: (typeof links)[number]["icon"] }) {
  const cls = "h-[18px] w-[18px] shrink-0 opacity-80";
  switch (name) {
    case "dashboard":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z" strokeLinejoin="round" />
        </svg>
      );
    case "punch":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
      );
    case "bell":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
        </svg>
      );
    case "chart":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 3v18h18" strokeLinecap="round" />
          <path d="M7 16v-4M12 16V8M17 16v-6" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      );
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, name, email, clear, token } = useAuthStore();
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

  const useCompanyBackgroundImage =
    backgroundTheme === "DEFAULT" && Boolean(bgUrl);

  return (
    <div
      className={cn("min-h-screen text-slate-900 dark:text-slate-100", backgroundShellClass(backgroundTheme))}
      style={
        useCompanyBackgroundImage
          ? {
              backgroundImage: `linear-gradient(rgb(241 245 249 / 0.92), rgb(241 245 249 / 0.92)), url(${bgUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
            }
          : undefined
      }
    >
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--pm-border)] bg-[var(--pm-sidebar)]/95 shadow-pm backdrop-blur-xl dark:bg-slate-950/95">
        <div className="border-b border-[var(--pm-border)] px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-md">
              PM
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                Puncher Manager
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Workforce
              </div>
            </div>
          </div>
          {name ? (
            <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
              <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100" title={name}>
                {name}
              </div>
              {email ? (
                <div className="mt-0.5 truncate text-xs text-[var(--pm-muted)]" title={email}>
                  {email}
                </div>
              ) : null}
              {role ? (
                <Badge tone="success" className="mt-2">
                  {role.replace(/_/g, " ")}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
          {visible.map((l) => {
            const active = pathname === l.href || (l.href !== "/dashboard" && pathname?.startsWith(l.href + "/"));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex items-center gap-3 border-l-[3px] pl-2.5",
                  active
                    ? "border-emerald-600 pm-sidebar-nav-active"
                    : "border-transparent pm-sidebar-nav",
                )}
              >
                <NavIcon name={l.icon} />
                <span className="flex flex-1 items-center justify-between gap-2">
                  <span>{t(lang, l.labelKey)}</span>
                  {l.href === "/notifications" && unreadCount > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--pm-border)] p-3">
          <button
            type="button"
            className="pm-btn pm-btn-danger w-full justify-start px-3 py-2.5 text-sm"
            onClick={() => {
              clear();
              router.push("/login");
            }}
          >
            {t(lang, "action.logout")}
          </button>
        </div>
      </aside>

      <div className="pl-64">
        <header className="sticky top-0 z-30 pm-glass-bar">
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-6 py-3">
            <p className="hidden text-sm text-[var(--pm-muted)] sm:block">
              {pathname === "/dashboard" ? t(lang, "nav.dashboard") : pathname?.split("/").filter(Boolean).pop()?.replace(/-/g, " ") ?? ""}
            </p>
            <button
              type="button"
              onClick={() => {
                setRefreshKey((k) => k + 1);
                router.refresh();
              }}
              className="pm-btn pm-btn-secondary ml-auto gap-2"
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
        </header>

        <main className="mx-auto max-w-screen-2xl px-6 pb-10 pt-4">
          <div key={refreshKey}>
            <CompanyHeader />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
