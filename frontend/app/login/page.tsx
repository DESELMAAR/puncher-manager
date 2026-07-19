"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { LoginResponse } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("employee@puncher.com");
  const [password, setPassword] = useState("demo123");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>("/api/auth/login", { email, password });
      setAuth({
        token: data.token,
        userId: data.userId,
        name: data.name,
        email: data.email,
        role: data.role,
        employeeId: data.employeeId,
        departmentId: data.departmentId,
        teamId: data.teamId,
      });
      router.push("/dashboard");
    } catch (ex: unknown) {
      const msg =
        (ex as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Login failed";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[45%] overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-80" />
        <div className="relative">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-bold text-white shadow-lg shadow-emerald-900/40">
            PM
          </div>
          <h2 className="mt-8 text-3xl font-semibold tracking-tight text-white">Puncher Manager</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-emerald-100/80">
            Professional attendance, scheduling, and team insights — built for modern workforce operations.
          </p>
        </div>
        <p className="relative text-xs text-slate-400">© Puncher Manager</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-12 dark:bg-slate-950">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md space-y-6 rounded-2xl border border-[var(--pm-border)] bg-white p-8 shadow-pm-lg dark:bg-slate-900"
        >
          <div className="lg:hidden">
            <div className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
              PM
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Sign in</h1>
            <p className="mt-1 text-sm text-[var(--pm-muted)]">Use your work email and password</p>
          </div>
          {err ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {err}
            </p>
          ) : null}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center  text-xs text-[var(--pm-muted)]">
            Demo: superadmin@puncher.com / admin123 · employee@puncher.com / demo123
          </p>
        </form>
      </div>
    </div>
  );
}
