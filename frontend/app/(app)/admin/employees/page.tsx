"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmployeeModal, type EmployeeFormState } from "@/components/employees/EmployeeModal";
import { api } from "@/lib/api";
import { extractApiMessage } from "@/lib/errors";
import type { DepartmentDto, TeamDto, UserDto, UserRole } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

function buildUpsertBody(form: EmployeeFormState, mode: "create" | "edit") {
  const body: Record<string, unknown> = {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    employeeId: form.employeeId.trim(),
    phoneNumber: form.phoneNumber.trim() || null,
    hiringDate: form.hiringDate ? form.hiringDate : null,
    status: form.status,
    role: "EMPLOYEE",
    teamId: form.teamId,
    departmentId: null,
  };
  if (mode === "create") {
    body.password = form.password;
  } else if (form.password.trim()) {
    body.password = form.password;
  }
  return body;
}

export default function EmployeesAdminPage() {
  const viewerRole = useAuthStore((s) => s.role) as UserRole;
  const authDeptId = useAuthStore((s) => s.departmentId);
  const authTeamId = useAuthStore((s) => s.teamId);

  const [rows, setRows] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);

  const employees = useMemo(
    () => rows.filter((u) => u.role === "EMPLOYEE"),
    [rows],
  );

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
    if (viewerRole !== "SUPER_ADMIN" && viewerRole !== "ADMIN") return;
    void (async () => {
      try {
        const { data } = await api.get<DepartmentDto[]>("/api/departments");
        setDepartments(data);
        setSelectedDeptId((prev) => prev || data[0]?.id || "");
      } catch (e) {
        toast.error(extractApiMessage(e));
      }
    })();
  }, [viewerRole]);

  useEffect(() => {
    const deptId =
      viewerRole === "SUPER_ADMIN" || viewerRole === "ADMIN"
        ? selectedDeptId
        : viewerRole === "DEPT_MANAGER"
          ? authDeptId
          : null;
    if (!deptId) {
      setTeams([]);
      return;
    }
    setTeamsLoading(true);
    void (async () => {
      try {
        const { data } = await api.get<TeamDto[]>(`/api/teams/department/${deptId}`);
        setTeams(data);
      } catch (e) {
        toast.error(extractApiMessage(e));
        setTeams([]);
      } finally {
        setTeamsLoading(false);
      }
    })();
  }, [viewerRole, selectedDeptId, authDeptId]);

  const teamOptions = useMemo(() => {
    if (viewerRole === "TEAM_LEADER") {
      if (!authTeamId) return [];
      return [{ id: authTeamId, name: "Your team" }];
    }
    return teams.map((t) => ({ id: t.id, name: t.name }));
  }, [viewerRole, authTeamId, teams]);

  const canManage =
    viewerRole === "SUPER_ADMIN" ||
    viewerRole === "ADMIN" ||
    viewerRole === "DEPT_MANAGER" ||
    viewerRole === "TEAM_LEADER";

  const scopeHint = useMemo(() => {
    switch (viewerRole) {
      case "SUPER_ADMIN":
      case "ADMIN":
        return "Organization-wide employees. Filter teams by department.";
      case "DEPT_MANAGER":
        return "Employees in your department only.";
      case "TEAM_LEADER":
        return "Employees on your team only.";
      default:
        return "";
    }
  }, [viewerRole]);

  async function handleSubmit(form: EmployeeFormState) {
    try {
      if (modalMode === "create") {
        await api.post("/api/users", buildUpsertBody(form, "create"));
        toast.success("Employee created", {
          description: `${form.name} can sign in with the email and password you set.`,
        });
      } else if (editing) {
        await api.put(`/api/users/${editing.id}`, buildUpsertBody(form, "edit"));
        toast.success("Employee updated");
      }
      setModalOpen(false);
      setEditing(null);
      await loadUsers();
    } catch (e) {
      const msg = extractApiMessage(e);
      toast.error("Could not save employee", { description: msg });
      throw new Error(msg);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/users/${deleteTarget.id}`);
      toast.success("Employee removed", { description: deleteTarget.email });
      setDeleteTarget(null);
      await loadUsers();
    } catch (e) {
      toast.error("Could not delete", { description: extractApiMessage(e) });
    }
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="font-medium text-amber-900 dark:text-amber-100">Access denied</p>
        <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
          Your role cannot manage employee accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Employees
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {scopeHint} Create, update, or remove Employee accounts. API errors appear as toasts
            with the server message.
          </p>
        </div>
        <button
          type="button"
          disabled={
            teamOptions.length === 0 ||
            teamsLoading ||
            ((viewerRole === "SUPER_ADMIN" || viewerRole === "ADMIN") && !selectedDeptId)
          }
          onClick={() => {
            setModalMode("create");
            setEditing(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add employee
        </button>
      </header>

      {(viewerRole === "SUPER_ADMIN" || viewerRole === "ADMIN") && departments.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Department (for team list)
            <select
              className="mt-2 w-full max-w-md rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          {teamsLoading && (
            <p className="mt-2 text-xs text-zinc-500">Loading teams…</p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Directory ({employees.length})
          </h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Loading employees…</div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">
            No employees in your scope yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Name</th>
                  <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Email</th>
                  <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    Employee ID
                  </th>
                  <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Status</th>
                  <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Team</th>
                  <th className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-zinc-100 transition hover:bg-zinc-50/50 dark:border-zinc-800 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{u.employeeId}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            : u.status === "ON_LEAVE"
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                              : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-zinc-500">
                      {u.teamId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-2 text-emerald-600 hover:underline dark:text-emerald-400"
                        onClick={() => {
                          setModalMode("edit");
                          setEditing(u);
                          setModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:underline dark:text-red-400"
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
      </div>

      <EmployeeModal
        key={`${modalOpen}-${modalMode}-${editing?.id ?? "new"}-${teamOptions[0]?.id ?? ""}`}
        open={modalOpen}
        mode={modalMode}
        initial={editing}
        viewerRole={viewerRole}
        teamOptions={teamOptions}
        lockTeam={viewerRole === "TEAM_LEADER"}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative z-[111] w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">Remove employee?</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This will delete{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">{deleteTarget.name}</strong> (
              {deleteTarget.email}). This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
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
