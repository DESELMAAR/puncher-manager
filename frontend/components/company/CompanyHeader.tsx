"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CompanySettingsDto } from "@/lib/types";

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

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
      {meta ? (
        <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{meta}</div>
      ) : (
        <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
          Company info not configured yet.
        </div>
      )}
    </div>
  );
}

