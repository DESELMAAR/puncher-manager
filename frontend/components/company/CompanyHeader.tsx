"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CompanySettingsDto } from "@/lib/types";
import { Card } from "@/components/ui/Card";

function lineOrNull(...parts: Array<string | null | undefined>) {
  const s = parts.filter((p) => p && p.trim()).join(" · ");
  return s.trim() ? s : null;
}

export function CompanyHeader() {
  const [settings, setSettings] = useState<CompanySettingsDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<CompanySettingsDto>("/api/settings/company");
        if (!cancelled) setSettings(data);
      } catch {
        if (!cancelled) setSettings(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const title = settings?.companyName?.trim() || "Company";
  const meta = lineOrNull(
    settings?.siteLocation,
    settings?.departmentLabel,
    settings?.postalAddress,
  );
  const logo = settings?.logoUrl?.trim() || null;

  return (
    <Card padding="sm" className="mb-5 border-emerald-200/60 bg-gradient-to-r from-white to-emerald-50/40 dark:from-slate-900 dark:to-emerald-950/20 dark:border-emerald-900/40">
      <div className="flex items-center gap-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt="Company logo"
            className="h-11 w-11 rounded-lg border border-[var(--pm-border)] bg-white object-contain p-1 shadow-sm"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-800">
            Co
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</div>
          {meta ? (
            <div className="mt-0.5 text-xs text-[var(--pm-muted)]">{meta}</div>
          ) : (
            <div className="mt-0.5 text-xs text-[var(--pm-muted)]">Company info not configured yet.</div>
          )}
        </div>
      </div>
    </Card>
  );
}
