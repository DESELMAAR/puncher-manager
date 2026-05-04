"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalScrim } from "@/components/ModalScrim";
import type { DepartmentDto, TeamDto, UserDto, UserRole } from "@/lib/types";

export type StaffFormState = {
  name: string;
  email: string;
  employeeId: string;
  phoneNumber: string;
  hiringDate: string;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE";
  password: string;
  role: UserRole;
  departmentId: string;
  teamId: string;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: UserDto | null;
  viewerRole: UserRole;
  /** When set (department manager), department is fixed and only TEAM_LEADER accounts are managed. */
  lockedDepartmentId?: string;
  departments: DepartmentDto[];
  teamsForDept: TeamDto[];
  teamsLoading: boolean;
  /** When department changes (e.g. for EMPLOYEE team list), parent loads teams. */
  onDepartmentChange?: (departmentId: string) => void;
  onClose: () => void;
  onSubmit: (payload: StaffFormState) => Promise<void>;
};

function emptyForm(role: UserRole, departmentId = ""): StaffFormState {
  return {
    name: "",
    email: "",
    employeeId: "",
    phoneNumber: "",
    hiringDate: "",
    status: "ACTIVE",
    password: "",
    role,
    departmentId,
    teamId: "",
  };
}

function userToForm(u: UserDto): StaffFormState {
  return {
    name: u.name,
    email: u.email,
    employeeId: u.employeeId,
    phoneNumber: u.phoneNumber ?? "",
    hiringDate: u.hiringDate ? u.hiringDate.slice(0, 10) : "",
    status: u.status as StaffFormState["status"],
    password: "",
    role: u.role,
    departmentId: u.departmentId ?? "",
    teamId: u.teamId ?? "",
  };
}

export function StaffUserModal({
  open,
  mode,
  initial,
  viewerRole,
  lockedDepartmentId,
  departments,
  teamsForDept,
  teamsLoading,
  onDepartmentChange,
  onClose,
  onSubmit,
}: Props) {
  const teamLeaderOnly = viewerRole === "DEPT_MANAGER" && !!lockedDepartmentId;

  const [form, setForm] = useState<StaffFormState>(() =>
    emptyForm("DEPT_MANAGER"),
  );
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const roleOptions: UserRole[] = useMemo(() => {
    if (teamLeaderOnly) {
      return ["TEAM_LEADER"];
    }
    if (viewerRole === "SUPER_ADMIN") {
      return [
        "SUPER_ADMIN",
        "ADMIN",
        "DEPT_MANAGER",
        "TEAM_LEADER",
        "EMPLOYEE",
      ];
    }
    return ["ADMIN", "DEPT_MANAGER", "TEAM_LEADER", "EMPLOYEE"];
  }, [viewerRole, teamLeaderOnly]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setForm(userToForm(initial));
    } else if (teamLeaderOnly && lockedDepartmentId) {
      setForm(emptyForm("TEAM_LEADER", lockedDepartmentId));
    } else {
      setForm(emptyForm("DEPT_MANAGER"));
    }
    setLocalErrors({});
  }, [open, mode, initial, teamLeaderOnly, lockedDepartmentId]);

  useEffect(() => {
    if (!open || !onDepartmentChange) return;
    if (form.role === "EMPLOYEE" && form.departmentId) {
      onDepartmentChange(form.departmentId);
    }
    if (form.role === "TEAM_LEADER" && form.departmentId) {
      onDepartmentChange(form.departmentId);
    }
  }, [open, form.role, form.departmentId, onDepartmentChange]);

  if (!open) return null;

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    if (!form.employeeId.trim()) e.employeeId = "Employee ID is required";
    if (mode === "create" && !form.password.trim()) {
      e.password = "Password is required for new accounts";
    }
    if (form.role === "SUPER_ADMIN") {
      /* ok */
    } else if (form.role === "DEPT_MANAGER" && !form.departmentId) {
      e.departmentId = "Department is required for a department manager";
    } else if (form.role === "EMPLOYEE") {
      if (!form.teamId) e.teamId = "Team is required for employees";
    } else if (form.role === "TEAM_LEADER") {
      if (!form.departmentId) {
        e.departmentId = "Department is required";
      }
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

  const showDept =
    form.role !== "SUPER_ADMIN" &&
    (form.role === "DEPT_MANAGER" ||
      form.role === "TEAM_LEADER" ||
      form.role === "EMPLOYEE");
  const showTeam = form.role === "EMPLOYEE" || form.role === "TEAM_LEADER";
  const deptLocked = !!lockedDepartmentId && teamLeaderOnly;

  return (
    <ModalScrim
      onDismiss={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-zinc-950/60 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[101] my-8 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {teamLeaderOnly
                ? mode === "create"
                  ? "Add team leader"
                  : "Edit team leader"
                : mode === "create"
                  ? "Add user"
                  : "Edit user"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {teamLeaderOnly
                ? "Create TEAM_LEADER users with your department only; team is optional until you add a team and pick them as leader on the Teams page."
                : "Org hierarchy: DEPT_MANAGER → TEAM_LEADER → EMPLOYEE. Assign departments and teams to match API rules."}
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
            label="Role"
            input={
              teamLeaderOnly ? (
                <input
                  type="text"
                  readOnly
                  className={inputClass(false)}
                  value="TEAM_LEADER"
                />
              ) : (
                <select
                  className={inputClass(false)}
                  value={form.role}
                  onChange={(x) => {
                    const newRole = x.target.value as UserRole;
                    setForm((f) => ({
                      ...f,
                      role: newRole,
                      departmentId: newRole === "SUPER_ADMIN" ? "" : f.departmentId,
                      teamId: "",
                    }));
                  }}
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )
            }
          />

          <Field
            label="Full name"
            error={localErrors.name}
            input={
              <input
                className={inputClass(!!localErrors.name)}
                value={form.name}
                onChange={(x) => setForm((f) => ({ ...f, name: x.target.value }))}
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
                onChange={(x) =>
                  setForm((f) => ({ ...f, employeeId: x.target.value }))
                }
              />
            }
          />
          <Field
            label="Phone"
            input={
              <input
                className={inputClass(false)}
                value={form.phoneNumber}
                onChange={(x) =>
                  setForm((f) => ({ ...f, phoneNumber: x.target.value }))
                }
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
                onChange={(x) =>
                  setForm((f) => ({ ...f, hiringDate: x.target.value }))
                }
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
                    status: x.target.value as StaffFormState["status"],
                  }))
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ON_LEAVE">On leave</option>
              </select>
            }
          />

          {showDept && (
            <Field
              label="Department"
              error={localErrors.departmentId}
              input={
                deptLocked ? (
                  <select
                    className={inputClass(false)}
                    value={form.departmentId}
                    disabled
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    className={inputClass(!!localErrors.departmentId)}
                    value={form.departmentId}
                    onChange={(x) => {
                      const v = x.target.value;
                      setForm((f) => ({
                        ...f,
                        departmentId: v,
                        teamId:
                          f.role === "EMPLOYEE" || f.role === "TEAM_LEADER" ? "" : f.teamId,
                      }));
                      onDepartmentChange?.(v);
                    }}
                  >
                    <option value="">— Select —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )
              }
            />
          )}

          {showTeam && (
            <Field
              label={form.role === "TEAM_LEADER" ? "Team (optional)" : "Team"}
              error={localErrors.teamId}
              input={
                <select
                  className={inputClass(!!localErrors.teamId)}
                  value={form.teamId}
                  disabled={!form.departmentId || teamsLoading}
                  onChange={(x) =>
                    setForm((f) => ({ ...f, teamId: x.target.value }))
                  }
                >
                  <option value="">
                    {teamsLoading
                      ? "Loading…"
                      : form.role === "TEAM_LEADER"
                        ? "— No team yet —"
                        : "— Select team —"}
                  </option>
                  {teamsForDept.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              }
            />
          )}

          <Field
            label={mode === "create" ? "Password" : "New password (optional)"}
            error={localErrors.password}
            input={
              <input
                type="password"
                className={inputClass(!!localErrors.password)}
                value={form.password}
                onChange={(x) =>
                  setForm((f) => ({ ...f, password: x.target.value }))
                }
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
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </ModalScrim>
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
