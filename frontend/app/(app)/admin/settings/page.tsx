"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { extractApiMessage } from "@/lib/errors";
import type { CompanySettingsDto, UserRole } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

type FormState = {
  companyName: string;
  postalAddress: string;
  departmentLabel: string;
  siteLocation: string;
  logoUrl: string;
  backgroundImageUrl: string;
};

export default function SettingsPage() {
  const role = useAuthStore((s) => s.role) as UserRole;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    companyName: "",
    postalAddress: "",
    departmentLabel: "",
    siteLocation: "",
    logoUrl: "",
    backgroundImageUrl: "",
  });

  useEffect(() => {
    if (role !== "SUPER_ADMIN") return;
    void (async () => {
      setLoading(true);
      try {
        const { data } = await api.get<CompanySettingsDto>("/api/settings/company");
        setForm({
          companyName: data.companyName ?? "",
          postalAddress: data.postalAddress ?? "",
          departmentLabel: data.departmentLabel ?? "",
          siteLocation: data.siteLocation ?? "",
          logoUrl: data.logoUrl ?? "",
          backgroundImageUrl: data.backgroundImageUrl ?? "",
        });
      } catch (e) {
        toast.error(extractApiMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  if (role !== "SUPER_ADMIN") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="font-medium text-amber-900 dark:text-amber-100">Access denied</p>
        <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
          Only SUPER_ADMIN can manage company settings.
        </p>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/settings/company", {
        companyName: form.companyName,
        postalAddress: form.postalAddress,
        departmentLabel: form.departmentLabel || null,
        siteLocation: form.siteLocation || null,
        logoUrl: form.logoUrl || null,
        backgroundImageUrl: form.backgroundImageUrl || null,
      });
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Could not save", { description: extractApiMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!confirm("Delete company settings?")) return;
    setSaving(true);
    try {
      await api.delete("/api/settings/company");
      setForm({
        companyName: "",
        postalAddress: "",
        departmentLabel: "",
        siteLocation: "",
        logoUrl: "",
        backgroundImageUrl: "",
      });
      toast.success("Settings cleared");
    } catch (e) {
      toast.error("Could not clear", { description: extractApiMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Company info shown at the top for all users.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 font-medium">Company name</div>
              <input
                value={form.companyName}
                onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="Acme Corp"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Site location</div>
              <input
                value={form.siteLocation}
                onChange={(e) => setForm((p) => ({ ...p, siteLocation: e.target.value }))}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="Tunis HQ / Plant 2 / …"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Logo URL</div>
              <input
                value={form.logoUrl}
                onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="https://…/logo.png"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Header background image URL</div>
              <input
                value={form.backgroundImageUrl}
                onChange={(e) => setForm((p) => ({ ...p, backgroundImageUrl: e.target.value }))}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="https://…/background.jpg"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Department label</div>
              <input
                value={form.departmentLabel}
                onChange={(e) => setForm((p) => ({ ...p, departmentLabel: e.target.value }))}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="North region / Branch A / …"
              />
            </label>

            <label className="text-sm sm:col-span-2">
              <div className="mb-1 font-medium">Postal address</div>
              <textarea
                value={form.postalAddress}
                onChange={(e) => setForm((p) => ({ ...p, postalAddress: e.target.value }))}
                className="min-h-[90px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="Street, postal code, city, country"
              />
            </label>

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={clear}
                className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm dark:border-zinc-600 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

