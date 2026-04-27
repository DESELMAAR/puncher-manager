"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { extractApiMessage } from "@/lib/errors";
import type { DepartmentDto, TeamDto, UserDto } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

export default function TeamsAdminPage() {
  const viewerRole = useAuthStore((s) => s.role);
  const authDeptId = useAuthStore((s) => s.departmentId);
  const allowed =
    viewerRole === "SUPER_ADMIN" ||
    viewerRole === "ADMIN" ||
    viewerRole === "DEPT_MANAGER";

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamDto | null>(null);
  const [form, setForm] = useState({
    name: "",
    departmentId: "",
    teamLeaderId: "",
  });

  const effectiveDeptId =
    viewerRole === "DEPT_MANAGER" && authDeptId ? authDeptId : selectedDeptId;

  const loadMeta = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, uRes] = await Promise.all([
        api.get<DepartmentDto[]>("/api/departments"),
        api.get<UserDto[]>("/api/users"),
      ]);
      setDepartments(dRes.data);
      setUsers(uRes.data);
      if (viewerRole === "DEPT_MANAGER" && authDeptId) {
        setSelectedDeptId(authDeptId);
      }
    } catch (e) {
      toast.error(extractApiMessage(e));
    } finally {
      setLoading(false);
    }
  }, [viewerRole, authDeptId]);

  const loadTeams = useCallback(async () => {
    if (!effectiveDeptId) {
      setTeams([]);
      return;
    }
    setTeamsLoading(true);
    try {
      const res = await api.get<TeamDto[]>(
        `/api/teams/department/${effectiveDeptId}`,
      );
      setTeams(res.data);
    } catch (e) {
      toast.error(extractApiMessage(e));
    } finally {
      setTeamsLoading(false);
    }
  }, [effectiveDeptId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  const teamLeadersInDept = useMemo(() => {
    return users.filter(
      (u) =>
        u.role === "TEAM_LEADER" &&
        u.departmentId === effectiveDeptId,
    );
  }, [users, effectiveDeptId]);

  const userNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.id, u.name);
    return m;
  }, [users]);

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      setForm({
        name: editing.name,
        departmentId: editing.departmentId,
        teamLeaderId: editing.teamLeaderId ?? "",
      });
    } else {
      setForm({
        name: "",
        departmentId: effectiveDeptId || "",
        teamLeaderId: "",
      });
    }
  }, [modalOpen, editing, effectiveDeptId]);

  async function save() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const deptId = viewerRole === "DEPT_MANAGER" ? authDeptId : form.departmentId;
    if (!deptId) {
      toast.error("Department is required");
      return;
    }
    if (!form.teamLeaderId) {
      toast.error("Team leader is required");
      return;
    }
    const body = {
      name: form.name.trim(),
      departmentId: deptId,
      teamLeaderId: form.teamLeaderId,
    };
    try {
      if (editing) {
        await api.put(`/api/teams/${editing.id}`, body);
        toast.success("Team updated");
      } else {
        await api.post("/api/teams", body);
        toast.success("Team created");
      }
      setModalOpen(false);
      setEditing(null);
      await loadTeams();
    } catch (e) {
      toast.error(extractApiMessage(e));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/teams/${deleteTarget.id}`);
      toast.success("Team deleted");
      setDeleteTarget(null);
      await loadTeams();
    } catch (e) {
      toast.error(extractApiMessage(e));
    }
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="font-medium">You do not have permission to manage teams.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Each team belongs to a department and has a{" "}
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">
              TEAM_LEADER
            </code>{" "}
            assigned. Department managers create teams in their department; Super Admin and Admin can
            manage any department.
          </p>
        </div>
        <button
          type="button"
          disabled={!effectiveDeptId}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          Add team
        </button>
      </header>

      {viewerRole !== "DEPT_MANAGER" && (
        <label className="block max-w-md text-sm font-medium">
          Department
          <select
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
          >
            <option value="">— Select —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {viewerRole === "DEPT_MANAGER" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Managing teams in your assigned department only.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : teamsLoading ? (
        <p className="text-sm text-zinc-500">Loading teams…</p>
      ) : !effectiveDeptId ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Select a department to list teams.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Team leader</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-zinc-100 shadow-[inset_0_0_0_2px_rgba(0,0,0,0)] transition hover:bg-zinc-50/70 hover:shadow-[inset_0_0_0_2px_rgba(16,185,129,0.35)] dark:border-zinc-800 dark:hover:bg-zinc-900/40 dark:hover:shadow-[inset_0_0_0_2px_rgba(16,185,129,0.25)]"
                >
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {t.teamLeaderId ? userNameById.get(t.teamLeaderId) || "—" : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="mr-2 text-emerald-600 hover:underline"
                      onClick={() => {
                        setEditing(t);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => setDeleteTarget(t)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {teams.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">
              No teams in this department yet.
            </p>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative z-[101] w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-xl font-semibold">
              {editing ? "Edit team" : "New team"}
            </h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium">
                Name *
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              {viewerRole !== "DEPT_MANAGER" && (
                <label className="block text-sm font-medium">
                  Department *
                  <select
                    className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                    value={form.departmentId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, departmentId: e.target.value }))
                    }
                  >
                    <option value="">— Select —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm font-medium">
                Team leader (TEAM_LEADER in this department) *
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  value={form.teamLeaderId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, teamLeaderId: e.target.value }))
                  }
                >
                  <option value="">— Select —</option>
                  {(viewerRole === "DEPT_MANAGER" ? teamLeadersInDept : users.filter(
                    (u) =>
                      u.role === "TEAM_LEADER" &&
                      u.departmentId === (form.departmentId || effectiveDeptId),
                  )).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </label>
              {teamLeadersInDept.length === 0 &&
                viewerRole === "DEPT_MANAGER" && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Create a user with role TEAM_LEADER in your department first (Staff & roles).
                  </p>
                )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => void save()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/70"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative z-[111] max-w-md rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="font-semibold">Delete team?</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {deleteTarget.name}
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
