"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmployeeModal, type EmployeeFormState } from "@/components/employees/EmployeeModal";
import { api } from "@/lib/api";
import { extractApiMessage } from "@/lib/errors";
import type { DepartmentDto, TeamDto, UserDto, UserRole } from "@/lib/types";
import { ModalScrim } from "@/components/ModalScrim";
import { useAuthStore } from "@/store/authStore";

/** Visual theme per team section (cycles if there are more teams than entries). */
const TEAM_SECTION_THEMES = [
  {
    bar: "border-l-sky-500",
    header: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100",
    rowTint: "bg-sky-50/60 dark:bg-sky-950/15",
    rowHover:
      "hover:bg-sky-100/70 dark:hover:bg-sky-950/30 hover:shadow-[inset_0_0_0_2px_rgba(14,165,233,0.35)] dark:hover:shadow-[inset_0_0_0_2px_rgba(14,165,233,0.2)]",
  },
  {
    bar: "border-l-violet-500",
    header:
      "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-100",
    rowTint: "bg-violet-50/60 dark:bg-violet-950/15",
    rowHover:
      "hover:bg-violet-100/70 dark:hover:bg-violet-950/30 hover:shadow-[inset_0_0_0_2px_rgba(139,92,246,0.35)] dark:hover:shadow-[inset_0_0_0_2px_rgba(139,92,246,0.2)]",
  },
  {
    bar: "border-l-amber-500",
    header:
      "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100",
    rowTint: "bg-amber-50/60 dark:bg-amber-950/15",
    rowHover:
      "hover:bg-amber-100/70 dark:hover:bg-amber-950/30 hover:shadow-[inset_0_0_0_2px_rgba(245,158,11,0.35)] dark:hover:shadow-[inset_0_0_0_2px_rgba(245,158,11,0.2)]",
  },
  {
    bar: "border-l-emerald-500",
    header:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100",
    rowTint: "bg-emerald-50/60 dark:bg-emerald-950/15",
    rowHover:
      "hover:bg-emerald-100/70 dark:hover:bg-emerald-950/30 hover:shadow-[inset_0_0_0_2px_rgba(16,185,129,0.35)] dark:hover:shadow-[inset_0_0_0_2px_rgba(16,185,129,0.2)]",
  },
  {
    bar: "border-l-rose-500",
    header: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-100",
    rowTint: "bg-rose-50/60 dark:bg-rose-950/15",
    rowHover:
      "hover:bg-rose-100/70 dark:hover:bg-rose-950/30 hover:shadow-[inset_0_0_0_2px_rgba(244,63,94,0.35)] dark:hover:shadow-[inset_0_0_0_2px_rgba(244,63,94,0.2)]",
  },
  {
    bar: "border-l-cyan-500",
    header: "bg-cyan-100 text-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-100",
    rowTint: "bg-cyan-50/60 dark:bg-cyan-950/15",
    rowHover:
      "hover:bg-cyan-100/70 dark:hover:bg-cyan-950/30 hover:shadow-[inset_0_0_0_2px_rgba(6,182,212,0.35)] dark:hover:shadow-[inset_0_0_0_2px_rgba(6,182,212,0.2)]",
  },
  {
    bar: "border-l-orange-500",
    header:
      "bg-orange-100 text-orange-950 dark:bg-orange-950/50 dark:text-orange-100",
    rowTint: "bg-orange-50/60 dark:bg-orange-950/15",
    rowHover:
      "hover:bg-orange-100/70 dark:hover:bg-orange-950/30 hover:shadow-[inset_0_0_0_2px_rgba(249,115,22,0.35)] dark:hover:shadow-[inset_0_0_0_2px_rgba(249,115,22,0.2)]",
  },
  {
    bar: "border-l-indigo-500",
    header:
      "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100",
    rowTint: "bg-indigo-50/60 dark:bg-indigo-950/15",
    rowHover:
      "hover:bg-indigo-100/70 dark:hover:bg-indigo-950/30 hover:shadow-[inset_0_0_0_2px_rgba(99,102,241,0.35)] dark:hover:shadow-[inset_0_0_0_2px_rgba(99,102,241,0.2)]",
  },
] as const;

const NO_TEAM_THEME = {
  bar: "border-l-zinc-400",
  header: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  rowTint: "bg-zinc-50/50 dark:bg-zinc-950/20",
  rowHover:
    "hover:bg-zinc-100/80 dark:hover:bg-zinc-900/50 hover:shadow-[inset_0_0_0_2px_rgba(113,113,122,0.35)] dark:hover:shadow-[inset_0_0_0_2px_rgba(113,113,122,0.25)]",
} as const;

function buildUpsertBody(
  form: EmployeeFormState,
  mode: "create" | "edit",
  role: "EMPLOYEE" | "TEAM_LEADER",
) {
  const body: Record<string, unknown> = {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    employeeId: form.employeeId.trim(),
    phoneNumber: form.phoneNumber.trim() || null,
    hiringDate: form.hiringDate ? form.hiringDate : null,
    status: form.status,
    role,
    teamId: form.teamId || null,
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
  const [managedKind, setManagedKind] = useState<"EMPLOYEE" | "TEAM_LEADER">("EMPLOYEE");

  const directory = useMemo(() => {
    if (viewerRole === "DEPT_MANAGER") {
      return rows.filter(
        (u) =>
          (u.role === "EMPLOYEE" || u.role === "TEAM_LEADER") &&
          (!authDeptId || u.departmentId === authDeptId),
      );
    }
    const base = rows.filter((u) => u.role === "EMPLOYEE");
    if (viewerRole === "SUPER_ADMIN") {
      if (!selectedDeptId) return base;
      return base.filter((u) => u.departmentId === selectedDeptId);
    }
    return base;
  }, [rows, viewerRole, selectedDeptId, authDeptId]);

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
        setSelectedDeptId((prev) => prev || data[0]?.id || "");
      } catch (e) {
        toast.error(extractApiMessage(e));
      }
    })();
  }, []);

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

  const deptNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of departments) m.set(d.id, d.name);
    return m;
  }, [departments]);

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams) m.set(t.id, t.name);
    return m;
  }, [teams]);

  const directoryByTeam = useMemo(() => {
    const byTeam = new Map<string, UserDto[]>();
    for (const u of directory) {
      const key = u.teamId ?? "";
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key)!.push(u);
    }
    const teamIdsSorted = Array.from(byTeam.keys())
      .filter((id) => id !== "")
      .sort((a, b) => {
        const na = teamNameById.get(a) ?? a;
        const nb = teamNameById.get(b) ?? b;
        return na.localeCompare(nb, undefined, { sensitivity: "base" });
      });
    type Theme = (typeof TEAM_SECTION_THEMES)[number] | typeof NO_TEAM_THEME;
    const sections: { teamId: string; users: UserDto[]; theme: Theme }[] = [];
    teamIdsSorted.forEach((id, i) => {
      const users = byTeam.get(id);
      if (users?.length) {
        sections.push({
          teamId: id,
          users,
          theme: TEAM_SECTION_THEMES[i % TEAM_SECTION_THEMES.length],
        });
      }
    });
    const noTeam = byTeam.get("") ?? [];
    if (noTeam.length) {
      sections.push({ teamId: "", users: noTeam, theme: NO_TEAM_THEME });
    }
    return sections;
  }, [directory, teamNameById]);

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
        return "Employees and team leaders in your department. Team leaders can be created without a team until you add a team and set them as leader.";
      case "TEAM_LEADER":
        return "Employees on your team only.";
      default:
        return "";
    }
  }, [viewerRole]);

  async function handleSubmit(form: EmployeeFormState) {
    try {
      const roleForBody: "EMPLOYEE" | "TEAM_LEADER" =
        modalMode === "edit" && editing
          ? editing.role === "TEAM_LEADER"
            ? "TEAM_LEADER"
            : "EMPLOYEE"
          : managedKind;
      // For DEPT_MANAGER, ensure the request is explicitly scoped to their department to match
      // backend access checks (even though department is also derived from teamId).
      const body = buildUpsertBody(form, modalMode, roleForBody);
      if (viewerRole === "DEPT_MANAGER" && authDeptId) {
        body.departmentId = authDeptId;
      }
      if (modalMode === "create") {
        await api.post("/api/users", body);
        toast.success(roleForBody === "TEAM_LEADER" ? "Team leader created" : "Employee created", {
          description: `${form.name} can sign in with the email and password you set.`,
        });
      } else if (editing) {
        await api.put(`/api/users/${editing.id}`, body);
        toast.success(roleForBody === "TEAM_LEADER" ? "Team leader updated" : "Employee updated");
      }
      setModalOpen(false);
      setEditing(null);
      await loadUsers();
    } catch (e) {
      const msg = extractApiMessage(e);
      toast.error("Could not save", { description: msg });
      throw new Error(msg);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/users/${deleteTarget.id}`);
      toast.success(
        deleteTarget.role === "TEAM_LEADER" ? "Team leader removed" : "Employee removed",
        { description: deleteTarget.email },
      );
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
            {scopeHint}{" "}
            {viewerRole === "DEPT_MANAGER"
              ? "Create, update, or remove employee and team leader accounts in your department."
              : "Create, update, or remove Employee accounts. API errors appear as toasts with the server message."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              teamOptions.length === 0 ||
              teamsLoading ||
              ((viewerRole === "SUPER_ADMIN" || viewerRole === "ADMIN") && !selectedDeptId)
            }
            onClick={() => {
              setManagedKind("EMPLOYEE");
              setModalMode("create");
              setEditing(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add employee
          </button>
          {viewerRole === "DEPT_MANAGER" && (
            <button
              type="button"
              disabled={teamOptions.length === 0 || teamsLoading}
              onClick={() => {
                setManagedKind("TEAM_LEADER");
                setModalMode("create");
                setEditing(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              Add team leader
            </button>
          )}
        </div>
      </header>

      {viewerRole === "SUPER_ADMIN" && departments.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Department (filter)
            <select
              className="mt-2 w-full max-w-md rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
            >
              <option value="">All departments</option>
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

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
        <h2 className="mb-4 px-1 text-sm font-semibold text-zinc-900 dark:text-white">
          Directory ({directory.length})
        </h2>
        {loading ? (
          <div className="rounded-xl bg-white p-12 text-center text-sm text-zinc-500 dark:bg-zinc-900">
            Loading directory…
          </div>
        ) : directory.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center text-sm text-zinc-500 dark:bg-zinc-900">
            No people in your scope yet.
          </div>
        ) : (
          <div className="space-y-6">
            {directoryByTeam.map(({ teamId, users, theme }) => (
              <div
                key={teamId || "no-team"}
                className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${theme.bar} border-l-4`}
              >
                <div className={`px-4 py-2.5 text-sm font-semibold ${theme.header}`}>
                  {teamId
                    ? (teamNameById.get(teamId) ?? "Team")
                    : "No team assigned"}{" "}
                  <span className="font-normal opacity-80">· {users.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/80">
                        <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                          Name
                        </th>
                        <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                          Email
                        </th>
                        <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                          Employee ID
                        </th>
                        <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                          Status
                        </th>
                        {viewerRole === "DEPT_MANAGER" && (
                          <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                            Role
                          </th>
                        )}
                        <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                          Department
                        </th>
                        <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                          Team
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr
                          key={u.id}
                          className={`border-b border-zinc-100 transition dark:border-zinc-800 ${theme.rowTint} ${theme.rowHover}`}
                        >
                          <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                            {u.name}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                            {u.employeeId}
                          </td>
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
                          {viewerRole === "DEPT_MANAGER" && (
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                              {u.role === "TEAM_LEADER" ? "Team leader" : "Employee"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                            {u.departmentId ? deptNameById.get(u.departmentId) || "—" : "—"}
                          </td>
                          <td className="max-w-[180px] truncate px-4 py-3 text-zinc-600 dark:text-zinc-400">
                            {u.teamId ? teamNameById.get(u.teamId) || "—" : "—"}
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
              </div>
            ))}
          </div>
        )}
      </div>

      <EmployeeModal
        key={`${modalOpen}-${modalMode}-${editing?.id ?? "new"}-${teamOptions[0]?.id ?? ""}-${managedKind}`}
        open={modalOpen}
        mode={modalMode}
        initial={editing}
        viewerRole={viewerRole}
        personKind={
          modalMode === "edit" && editing
            ? editing.role === "TEAM_LEADER"
              ? "TEAM_LEADER"
              : "EMPLOYEE"
            : managedKind
        }
        teamOptions={teamOptions}
        lockTeam={viewerRole === "TEAM_LEADER"}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      {deleteTarget && (
        <ModalScrim
          onDismiss={() => setDeleteTarget(null)}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
        >
          <div className="relative z-[111] w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">
              {deleteTarget.role === "TEAM_LEADER" ? "Remove team leader?" : "Remove employee?"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This will delete{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">{deleteTarget.name}</strong> (
              {deleteTarget.email}).
              {deleteTarget.role === "TEAM_LEADER" ? (
                <>
                  {" "}
                  They must not be the assigned leader of any team (reassign in Teams first).
                </>
              ) : null}{" "}
              This cannot be undone.
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
        </ModalScrim>
      )}
    </div>
  );
}
