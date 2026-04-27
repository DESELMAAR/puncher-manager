"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { extractApiMessage } from "@/lib/errors";
import type { DepartmentDto, UserDto } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

export default function DepartmentsAdminPage() {
  const viewerRole = useAuthStore((s) => s.role);
  const allowed = viewerRole === "SUPER_ADMIN" || viewerRole === "ADMIN";

  const [rows, setRows] = useState<DepartmentDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentDto | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    adminId: "",
    businessFirstStartHour: "",
    businessLastStartHour: "",
  });

  const deptManagers = useMemo(
    () => users.filter((u) => u.role === "DEPT_MANAGER"),
    [users],
  );

  const userNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.id, u.name);
    return m;
  }, [users]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, uRes] = await Promise.all([
        api.get<DepartmentDto[]>("/api/departments"),
        api.get<UserDto[]>("/api/users"),
      ]);
      setRows(dRes.data);
      setUsers(uRes.data);
    } catch (e) {
      toast.error(extractApiMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? "",
        adminId: editing.adminId ?? "",
        businessFirstStartHour:
          editing.businessFirstStartHour != null ? String(editing.businessFirstStartHour) : "",
        businessLastStartHour:
          editing.businessLastStartHour != null ? String(editing.businessLastStartHour) : "",
      });
    } else {
      setForm({
        name: "",
        description: "",
        adminId: "",
        businessFirstStartHour: "",
        businessLastStartHour: "",
      });
    }
  }, [modalOpen, editing]);

  async function save() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      adminId: form.adminId || null,
      businessFirstStartHour:
        form.businessFirstStartHour.trim() === "" ? null : Number(form.businessFirstStartHour),
      businessLastStartHour:
        form.businessLastStartHour.trim() === "" ? null : Number(form.businessLastStartHour),
    };
    try {
      if (editing) {
        await api.put(`/api/departments/${editing.id}`, body);
        toast.success("Department updated");
      } else {
        await api.post("/api/departments", body);
        toast.success("Department created");
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(extractApiMessage(e));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/departments/${deleteTarget.id}`);
      toast.success("Department deleted");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(extractApiMessage(e));
    }
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="font-medium">Only Super Admin and Admin can manage departments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Create and maintain organizational units. Assign a <strong>Department Manager</strong>{" "}
            (<code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">DEPT_MANAGER</code>
            ) as <em>admin</em> so they own reporting and team structure under this department.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700"
        >
          Add department
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
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Admin (DEPT_MANAGER)</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-zinc-100 shadow-[inset_0_0_0_2px_rgba(0,0,0,0)] transition hover:bg-zinc-50/70 hover:shadow-[inset_0_0_0_2px_rgba(16,185,129,0.35)] dark:border-zinc-800 dark:hover:bg-zinc-900/40 dark:hover:shadow-[inset_0_0_0_2px_rgba(16,185,129,0.25)]"
                >
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {d.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {d.adminId ? userNameById.get(d.adminId) || "—" : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="mr-2 text-emerald-600 hover:underline"
                      onClick={() => {
                        setEditing(d);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => setDeleteTarget(d)}
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
              {editing ? "Edit department" : "New department"}
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
              <label className="block text-sm font-medium">
                Description
                <textarea
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="block text-sm font-medium">
                Department manager (user with role DEPT_MANAGER)
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  value={form.adminId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setForm((f) => ({ ...f, adminId: id }));
                    if (!id) return;
                    const related = rows
                      .filter((d) => d.adminId === id && (!editing || d.id !== editing.id))
                      .map((d) => d.name);
                    if (related.length > 0) {
                      toast.message(
                        `This DEPT_MANAGER is already assigned to: ${related.join(", ")}`,
                      );
                    }
                  }}
                >
                  <option value="">— None —</option>
                  {deptManagers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Business first start hour (0–23)
                  <input
                    type="number"
                    min={0}
                    max={23}
                    className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                    value={form.businessFirstStartHour}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, businessFirstStartHour: e.target.value }))
                    }
                    placeholder="9"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Business last start hour (0–23)
                  <input
                    type="number"
                    min={0}
                    max={23}
                    className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                    value={form.businessLastStartHour}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, businessLastStartHour: e.target.value }))
                    }
                    placeholder="12"
                  />
                </label>
              </div>
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
            <h3 className="font-semibold">Delete department?</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {deleteTarget.name} — teams may be removed depending on database constraints.
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
