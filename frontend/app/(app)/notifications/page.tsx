"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { NotificationDto } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

export default function NotificationsPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const teamId = useAuthStore((s) => s.teamId);
  const [sendText, setSendText] = useState("");
  const [sendOk, setSendOk] = useState<string | null>(null);
  const baseURL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  async function load() {
    const { data } = await api.get<NotificationDto[]>("/api/notification/my");
    setItems(data);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!token) return;
    const url = `${baseURL}/api/notification/stream?access_token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    es.addEventListener("notification", (ev) => {
      try {
        const n = JSON.parse((ev as MessageEvent).data) as NotificationDto;
        setItems((prev) => [n, ...prev]);
      } catch {
        void load();
      }
    });
    es.onerror = () => setHint("SSE disconnected — refresh to reload list.");
    return () => es.close();
  }, [token, baseURL]);

  async function markRead(id: string) {
    await api.patch(`/api/notification/${id}/read`);
    void load();
  }

  async function sendTeam() {
    if (!teamId || !sendText.trim()) return;
    setSendOk(null);
    try {
      await api.post("/api/notification/send", { teamId, message: sendText.trim() });
      setSendText("");
      setSendOk("Sent to your team.");
    } catch (e: unknown) {
      setSendOk(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Send failed",
      );
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Notifications</h1>
      {role === "TEAM_LEADER" && teamId && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-semibold">Send to team</h2>
          <textarea
            className="mt-2 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            rows={3}
            value={sendText}
            onChange={(e) => setSendText(e.target.value)}
            placeholder="Message to all employees on your team…"
          />
          <button
            type="button"
            onClick={() => void sendTeam()}
            className="mt-2 rounded bg-emerald-600 px-3 py-1 text-sm text-white"
          >
            Send
          </button>
          {sendOk && <p className="mt-2 text-sm text-zinc-600">{sendOk}</p>}
        </div>
      )}
      {hint && <p className="text-sm text-amber-600">{hint}</p>}
      <ul className="space-y-3">
        {items.map((n) => (
          <li
            key={n.id}
            className={`rounded-lg border p-4 dark:border-zinc-800 ${
              n.read ? "opacity-60" : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900"
            }`}
          >
            <div className="text-sm font-medium">{n.senderName}</div>
            <p className="mt-1 text-sm">{n.message}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
              <span>{new Date(n.createdAt).toLocaleString()}</span>
              {!n.read && (
                <button
                  type="button"
                  className="text-emerald-600 hover:underline"
                  onClick={() => markRead(n.id)}
                >
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="text-zinc-500">No notifications yet.</p>}
    </div>
  );
}
