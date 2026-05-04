"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  StaffUserModal,
  type StaffFormState,
} from "@/components/admin/StaffUserModal";
import { ModalScrim } from "@/components/ModalScrim";
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
  } else if (form.role === "TEAM_LEADER") {
    body.departmentId = form.departmentId || null;
    body.teamId = form.teamId || null;
  } else if (form.role === "DEPT_MANAGER") {
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
  const authDeptId = useAuthStore((s) => s.departmentId);
  const allowed =
    viewerRole === "SUPER_ADMIN" ||
    viewerRole === "ADMIN" ||
    (viewerRole === "DEPT_MANAGER" && !!authDeptId);

  const [rows, setRows] = useState<UserDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [teamsForDept, setTeamsForDept] = useState<TeamDto[]>([]);
  const [allTeams, setAllTeams] = useState<TeamDto[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("");

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
    if (departments.length === 0) {
      setAllTeams([]);
      return;
    }
    void (async () => {
      try {
        const res = await Promise.all(
          departments.map((d) =>
            api.get<TeamDto[]>(`/api/teams/department/${d.id}`).then((r) => r.data).catch(() => []),
          ),
        );
        setAllTeams(res.flat());
      } catch {
        setAllTeams([]);
      }
    })();
  }, [departments]);

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

  const isDeptManagerStaffView = viewerRole === "DEPT_MANAGER";

  const sortedRows = useMemo(() => {
    const order: UserRole[] = [
      "SUPER_ADMIN",
      "ADMIN",
      "DEPT_MANAGER",
      "TEAM_LEADER",
      "EMPLOYEE",
    ];
    let list = [...rows];
    if (isDeptManagerStaffView && authDeptId) {
      list = list.filter(
        (u) => u.role === "TEAM_LEADER" && u.departmentId === authDeptId,
      );
    }
    return list.sort(
      (a, b) =>
        order.indexOf(a.role) - order.indexOf(b.role) ||
        a.name.localeCompare(b.name),
    );
  }, [rows, isDeptManagerStaffView, authDeptId]);

  const departmentsForModal = useMemo(() => {
    if (isDeptManagerStaffView && authDeptId) {
      return departments.filter((d) => d.id === authDeptId);
    }
    return departments;
  }, [departments, isDeptManagerStaffView, authDeptId]);

  const deptNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of departments) m.set(d.id, d.name);
    return m;
  }, [departments]);

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of allTeams) m.set(t.id, t.name);
    return m;
  }, [allTeams]);

  const teamsForDeptFilter = useMemo(() => {
    if (!deptFilter) return allTeams;
    return allTeams.filter((t) => t.departmentId === deptFilter);
  }, [allTeams, deptFilter]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortedRows.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (deptFilter && u.departmentId !== deptFilter) return false;
      if (teamFilter && u.teamId !== teamFilter) return false;
      if (!q) return true;
      const hay = `${u.name} ${u.email} ${u.employeeId}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sortedRows, query, roleFilter, deptFilter, teamFilter]);

  async function handleSubmit(form: StaffFormState) {
    try {
      const body =
        modalMode === "create"
          ? buildUpsertBody(form, "create")
          : buildUpsertBody(form, "edit");
      if (viewerRole === "DEPT_MANAGER" && authDeptId) {
        body.departmentId = authDeptId;
      }
      if (modalMode === "create") {
        await api.post("/api/users", body);
        toast.success("User created");
      } else if (editing) {
        await api.put(`/api/users/${editing.id}`, body);
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
        <p className="font-medium">Access denied</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {viewerRole === "DEPT_MANAGER" && !authDeptId
            ? "Your account has no department assigned. Ask a Super Admin to assign you to a department."
            : "Only Super Admin, Admin, or a department manager with a department can open Staff & roles."}
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
            {isDeptManagerStaffView ? (
              <>
                Create and manage <strong>TEAM_LEADER</strong> accounts in your department only.
                Assign each leader to a team here, then confirm they are set as that team&apos;s
                leader on the <strong>Teams</strong> page if needed.
              </>
            ) : (
              <>
                Define the org chain <strong>DEPT_MANAGER</strong> → <strong>TEAM_LEADER</strong> →{" "}
                <strong>EMPLOYEE</strong>. Create platform admins, department managers, and team
                leaders; assign a department manager on the <strong>Departments</strong> page;
                attach a team leader to teams on the <strong>Teams</strong> page.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setModalMode("create");
            setEditing(null);
            setStaffDeptFilter(isDeptManagerStaffView && authDeptId ? authDeptId : "");
            setModalOpen(true);
          }}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700"
        >
          {isDeptManagerStaffView ? "Add team leader" : "Add user"}
        </button>
      </header>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div
          className={`grid gap-3 ${isDeptManagerStaffView ? "md:grid-cols-2" : "md:grid-cols-5"}`}
        >
          <label className="text-sm md:col-span-2">
            <div className="mb-1 font-medium">Search</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name / email / employee ID"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>

          {!isDeptManagerStaffView && (
            <label className="text-sm">
              <div className="mb-1 font-medium">Role</div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value="">All</option>
                {(
                  [
                    "SUPER_ADMIN",
                    "ADMIN",
                    "DEPT_MANAGER",
                    "TEAM_LEADER",
                    "EMPLOYEE",
                  ] as UserRole[]
                ).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!isDeptManagerStaffView && (
            <label className="text-sm">
              <div className="mb-1 font-medium">Department</div>
              <select
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setTeamFilter("");
                }}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value="">All</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!isDeptManagerStaffView && (
            <label className="text-sm">
              <div className="mb-1 font-medium">Team</div>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value="">All</option>
                {teamsForDeptFilter.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {isDeptManagerStaffView && query.trim() && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">
              Showing <span className="font-medium">{filteredRows.length}</span> team leader
              {filteredRows.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              Clear search
            </button>
          </div>
        )}

        {(query || roleFilter || deptFilter || teamFilter) && !isDeptManagerStaffView && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">
              Showing <span className="font-medium">{filteredRows.length}</span> / {sortedRows.length}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setRoleFilter("");
                setDeptFilter("");
                setTeamFilter("");
              }}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

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
              {filteredRows.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-zinc-100 shadow-[inset_0_0_0_2px_rgba(0,0,0,0)] transition hover:bg-zinc-50/70 hover:shadow-[inset_0_0_0_2px_rgba(16,185,129,0.35)] dark:border-zinc-800 dark:hover:bg-zinc-900/40 dark:hover:shadow-[inset_0_0_0_2px_rgba(16,185,129,0.25)]"
                >
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs dark:bg-zinc-800">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {u.departmentId ? deptNameById.get(u.departmentId) || "—" : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {u.teamId ? teamNameById.get(u.teamId) || "—" : "—"}
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
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                    No matching users.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <StaffUserModal
        open={modalOpen}
        mode={modalMode}
        initial={editing}
        viewerRole={viewerRole}
        lockedDepartmentId={isDeptManagerStaffView ? authDeptId ?? undefined : undefined}
        departments={departmentsForModal}
        teamsForDept={teamsForDept}
        teamsLoading={teamsLoading}
        onDepartmentChange={handleDepartmentChangeForTeams}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />

      {deleteTarget && (
        <ModalScrim
          onDismiss={() => setDeleteTarget(null)}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-zinc-950/70 p-4"
        >
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
        </ModalScrim>
      )}
    </div>
  );
}
