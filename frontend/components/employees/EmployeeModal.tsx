"use client";

import { useEffect, useState } from "react";
import type { UserDto, UserRole } from "@/lib/types";

export type EmployeeFormState = {
  name: string;
  email: string;
  employeeId: string;
  phoneNumber: string;
  hiringDate: string;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE";
  password: string;
  teamId: string;
};

const emptyForm = (teamId: string): EmployeeFormState => ({
  name: "",
  email: "",
  employeeId: "",
  phoneNumber: "",
  hiringDate: "",
  status: "ACTIVE",
  password: "",
  teamId,
});

function userToForm(u: UserDto): EmployeeFormState {
  return {
    name: u.name,
    email: u.email,
    employeeId: u.employeeId,
    phoneNumber: u.phoneNumber ?? "",
    hiringDate: u.hiringDate ? u.hiringDate.slice(0, 10) : "",
    status: u.status as EmployeeFormState["status"],
    password: "",
    teamId: u.teamId ?? "",
  };
}

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: UserDto | null;
  viewerRole: UserRole;
  teamOptions: { id: string; name: string }[];
  /** When only one team (team leader), hide team selector */
  lockTeam?: boolean;
  onClose: () => void;
  onSubmit: (payload: EmployeeFormState) => Promise<void>;
};

export function EmployeeModal({
  open,
  mode,
  initial,
  viewerRole,
  teamOptions,
  lockTeam,
  onClose,
  onSubmit,
}: Props) {
  const defaultTeam = teamOptions[0]?.id ?? "";
  const [form, setForm] = useState<EmployeeFormState>(() => emptyForm(defaultTeam));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setForm(userToForm(initial));
    } else {
      setForm(emptyForm(lockTeam ? defaultTeam : defaultTeam));
    }
    setLocalErrors({});
  }, [open, mode, initial, lockTeam, defaultTeam]);

  if (!open) return null;

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    if (!form.employeeId.trim()) e.employeeId = "Employee ID is required";
    if (!form.teamId) e.teamId = "Team is required";
    if (mode === "create" && !form.password.trim()) {
      e.password = "Temporary password is required for new accounts";
    }
    setLocalErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  }

  const showTeamSelect = teamOptions.length > 1 || (!lockTeam && teamOptions.length === 1);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[101] w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {mode === "create" ? "Add employee" : "Edit employee"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {viewerRole === "TEAM_LEADER"
                ? "Employees are created in your team only."
                : "Role is fixed to Employee for this form."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Full name"
            error={localErrors.name}
            input={
              <input
                className={inputClass(!!localErrors.name)}
                value={form.name}
                onChange={(x) => setForm((f) => ({ ...f, name: x.target.value }))}
                autoComplete="name"
              />
            }
          />
          <Field
            label="Work email"
            error={localErrors.email}
            input={
              <input
                type="email"
                className={inputClass(!!localErrors.email)}
                value={form.email}
                onChange={(x) => setForm((f) => ({ ...f, email: x.target.value }))}
                autoComplete="email"
              />
            }
          />
          <Field
            label="Employee ID"
            error={localErrors.employeeId}
            input={
              <input
                className={inputClass(!!localErrors.employeeId)}
                value={form.employeeId}
                onChange={(x) => setForm((f) => ({ ...f, employeeId: x.target.value }))}
              />
            }
          />
          <Field
            label="Phone"
            input={
              <input
                className={inputClass(false)}
                value={form.phoneNumber}
                onChange={(x) => setForm((f) => ({ ...f, phoneNumber: x.target.value }))}
              />
            }
          />
          <Field
            label="Hiring date"
            input={
              <input
                type="date"
                className={inputClass(false)}
                value={form.hiringDate}
                onChange={(x) => setForm((f) => ({ ...f, hiringDate: x.target.value }))}
              />
            }
          />
          <Field
            label="Status"
            input={
              <select
                className={inputClass(false)}
                value={form.status}
                onChange={(x) =>
                  setForm((f) => ({
                    ...f,
                    status: x.target.value as EmployeeFormState["status"],
                  }))
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ON_LEAVE">On leave</option>
              </select>
            }
          />

          {showTeamSelect && (
            <Field
              label="Team"
              error={localErrors.teamId}
              input={
                <select
                  className={inputClass(!!localErrors.teamId)}
                  value={form.teamId}
                  disabled={!!lockTeam}
                  onChange={(x) => setForm((f) => ({ ...f, teamId: x.target.value }))}
                >
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              }
            />
          )}

          <Field
            label={mode === "create" ? "Temporary password" : "New password (optional)"}
            error={localErrors.password}
            input={
              <input
                type="password"
                className={inputClass(!!localErrors.password)}
                value={form.password}
                onChange={(x) => setForm((f) => ({ ...f, password: x.target.value }))}
                placeholder={mode === "edit" ? "Leave blank to keep current" : ""}
                autoComplete="new-password"
              />
            }
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Saving…" : mode === "create" ? "Create employee" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  input,
}: {
  label: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <div className="mt-1">{input}</div>
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function inputClass(invalid: boolean) {
  return `w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/30 dark:bg-zinc-950 ${
    invalid
      ? "border-red-500 focus:border-red-500"
      : "border-zinc-300 dark:border-zinc-600"
  }`;
}
