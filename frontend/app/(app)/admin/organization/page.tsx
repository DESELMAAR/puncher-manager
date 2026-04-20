"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  StaffUserModal,
  type StaffFormState,
} from "@/components/admin/StaffUserModal";
import { api } from "@/lib/api";
import { extractApiMessage } from "@/lib/errors";
import type { DepartmentDto, TeamDto, UserDto, UserRole } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

function buildUpsertBody(form: StaffFormState, mode: "create" | "edit") {
  const body: Record<string, unknown> = {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    employeeId: form.employeeId.trim(),
    phoneNumber: form.phoneNumber.trim() || null,
    hiringDate: form.hiringDate ? form.hiringDate : null,
    status: form.status,
    role: form.role,
    departmentId: null,
    teamId: null,
  };

  if (form.role === "SUPER_ADMIN") {
    body.departmentId = null;
    body.teamId = null;
  } else if (form.role === "EMPLOYEE") {
    body.teamId = form.teamId || null;
    body.departmentId = null;
  } else if (form.role === "TEAM_LEADER" || form.role === "DEPT_MANAGER") {
    body.departmentId = form.departmentId || null;
    body.teamId = null;
  } else if (form.role === "ADMIN") {
    body.departmentId = null;
    body.teamId = null;
  }

  if (mode === "create") {
    body.password = form.password;
  } else if (form.password.trim()) {
    body.password = form.password;
  }

  return body;
}

export default function OrganizationAdminPage() {
  const viewerRole = useAuthStore((s) => s.role) as UserRole;
  const allowed = viewerRole === "SUPER_ADMIN" || viewerRole === "ADMIN";

  const [rows, setRows] = useState<UserDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [teamsForDept, setTeamsForDept] = useState<TeamDto[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);

  /** Department selected in modal (for loading teams when editing EMPLOYEE). */
  const [staffDeptFilter, setStaffDeptFilter] = useState<string>("");

  const handleDepartmentChangeForTeams = useCallback((id: string) => {
    setStaffDeptFilter(id);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<UserDto[]>("/api/users");
      setRows(data);
    } catch (e) {
      toast.error(extractApiMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<DepartmentDto[]>("/api/departments");
        setDepartments(data);
      } catch (e) {
        toast.error(extractApiMessage(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!staffDeptFilter) {
      setTeamsForDept([]);
      return;
    }
    setTeamsLoading(true);
    void (async () => {
      try {
        const { data } = await api.get<TeamDto[]>(
          `/api/teams/department/${staffDeptFilter}`,
        );
        setTeamsForDept(data);
      } catch (e) {
        toast.error(extractApiMessage(e));
        setTeamsForDept([]);
      } finally {
        setTeamsLoading(false);
      }
    })();
  }, [staffDeptFilter]);

  const sortedRows = useMemo(() => {
    const order: UserRole[] = [
      "SUPER_ADMIN",
      "ADMIN",
      "DEPT_MANAGER",
      "TEAM_LEADER",
      "EMPLOYEE",
    ];
    return [...rows].sort(
      (a, b) =>
        order.indexOf(a.role) - order.indexOf(b.role) ||
        a.name.localeCompare(b.name),
    );
  }, [rows]);

  async function handleSubmit(form: StaffFormState) {
    try {
      if (modalMode === "create") {
        await api.post("/api/users", buildUpsertBody(form, "create"));
        toast.success("User created");
      } else if (editing) {
        await api.put(`/api/users/${editing.id}`, buildUpsertBody(form, "edit"));
        toast.success("User updated");
      }
      setModalOpen(false);
      setEditing(null);
      await loadUsers();
    } catch (e) {
      const msg = extractApiMessage(e);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/users/${deleteTarget.id}`);
      toast.success("User deleted");
      setDeleteTarget(null);
      await loadUsers();
    } catch (e) {
      toast.error(extractApiMessage(e));
    }
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="font-medium">Only Super Admin and Admin can open Staff & roles.</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Department managers manage team leaders and employees within their department from other
          admin pages.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Staff & roles
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Define the org chain <strong>DEPT_MANAGER</strong> → <strong>TEAM_LEADER</strong> →{" "}
            <strong>EMPLOYEE</strong>. Create platform admins, department managers, and team leaders;
            assign a department manager on the <strong>Departments</strong> page; attach a team
            leader to teams on the <strong>Teams</strong> page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setModalMode("create");
            setEditing(null);
            setStaffDeptFilter("");
            setModalOpen(true);
          }}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700"
        >
          Add user
        </button>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Team</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs dark:bg-zinc-800">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {u.departmentId ? u.departmentId.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {u.teamId ? u.teamId.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="mr-2 text-emerald-600 hover:underline"
                      onClick={() => {
                        setModalMode("edit");
                        setEditing(u);
                        setStaffDeptFilter(u.departmentId ?? "");
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => setDeleteTarget(u)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StaffUserModal
        open={modalOpen}
        mode={modalMode}
        initial={editing}
        viewerRole={viewerRole}
        departments={departments}
        teamsForDept={teamsForDept}
        teamsLoading={teamsLoading}
        onDepartmentChange={handleDepartmentChangeForTeams}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/70"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative z-[111] max-w-md rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="font-semibold">Delete user?</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {deleteTarget.name} ({deleteTarget.email})
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white"
                onClick={() => void confirmDelete()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
