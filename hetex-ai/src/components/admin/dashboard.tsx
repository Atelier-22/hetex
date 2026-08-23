"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Users,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { StatTile, MiniBars, FeedbackMeter, ShareBars } from "./charts";
import { apiFetch } from "@/lib/api-client";

type Overview = {
  users: {
    total: number;
    newToday: number;
    newWeek: number;
    newMonth: number;
    activeToday: number;
    activeWeek: number;
    signInsToday: number;
  };
  activity: {
    conversations: number;
    conversationsToday: number;
    messages: number;
    messagesToday: number;
    projects: number;
    assets: number;
    messagesPerUser: number;
  };
  feedback: {
    up: number;
    down: number;
    total: number;
    positiveRate: number | null;
  };
  privacy: { memoryEnabled: number; chatHistoryDisabled: number };
  tiers: { value: string; label: string; users: number }[];
  series: {
    day: string;
    signups: number;
    messages: number;
    signIns: number;
  }[];
  generatedAt: string;
};

type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isAdmin: boolean;
  messages: number;
  createdAt: string;
  lastActiveAt: string | null;
};

export function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [overview, list] = await Promise.all([
        apiFetch<Overview>("/admin/overview"),
        apiFetch<AdminUser[]>("/admin/users?limit=25"),
      ]);
      setData(overview);
      setUsers(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-hetex-red-500">{error}</p>
      </div>
    );
  }

  if (!data || !users) {
    return (
      <div className="space-y-4 p-6 md:p-8">
        <div className="h-8 w-48 animate-pulse rounded bg-black/5 dark:bg-white/5" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-black/5 dark:bg-white/5"
            />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-5 py-6 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Overview</h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Updated{" "}
              {new Date(data.generatedAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Headline numbers */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total accounts"
            value={data.users.total}
            sub={`+${data.users.newToday} today · +${data.users.newWeek} this week`}
            emphasis
          />
          <StatTile
            label="Active today"
            value={data.users.activeToday}
            sub={`${data.users.activeWeek} in the last 7 days`}
            emphasis
          />
          <StatTile
            label="Sign-ins today"
            value={data.users.signInsToday}
            sub="Each device counted separately"
            emphasis
          />
          <StatTile
            label="Messages today"
            value={data.activity.messagesToday}
            sub={`${data.activity.messages} all time`}
            emphasis
          />
        </div>

        {/* Trends — small multiples, each on its own scale */}
        <h2 className="mb-3 mt-8 text-sm font-semibold">Last 14 days</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <MiniBars
            title="New accounts"
            data={data.series.map((s) => ({ day: s.day, value: s.signups }))}
            total={data.series.reduce((n, s) => n + s.signups, 0)}
          />
          <MiniBars
            title="Sign-ins"
            data={data.series.map((s) => ({ day: s.day, value: s.signIns }))}
            total={data.series.reduce((n, s) => n + s.signIns, 0)}
          />
          <MiniBars
            title="Messages"
            data={data.series.map((s) => ({ day: s.day, value: s.messages }))}
            total={data.series.reduce((n, s) => n + s.messages, 0)}
          />
        </div>

        {/* Quality and adoption */}
        <h2 className="mb-3 mt-8 text-sm font-semibold">
          How it&apos;s being received
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <FeedbackMeter
            up={data.feedback.up}
            down={data.feedback.down}
            positiveRate={data.feedback.positiveRate}
          />
          <ShareBars title="Model in use" rows={data.tiers.map((t) => ({ label: t.label, value: t.users }))} />
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
            <h3 className="text-sm font-medium">Usage</h3>
            <dl className="mt-3 flex flex-col gap-2 text-xs">
              <Line label="Conversations" value={data.activity.conversations} />
              <Line
                label="Started today"
                value={data.activity.conversationsToday}
              />
              <Line
                label="Messages per account"
                value={data.activity.messagesPerUser}
              />
              <Line label="Projects" value={data.activity.projects} />
              <Line label="Files stored" value={data.activity.assets} />
            </dl>
          </div>
        </div>

        {/* Privacy posture */}
        <h2 className="mb-3 mt-8 text-sm font-semibold">Privacy choices</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            label="Accounts with memory on"
            value={data.privacy.memoryEnabled}
            sub={`of ${data.users.total} — off by default`}
          />
          <StatTile
            label="Accounts not saving history"
            value={data.privacy.chatHistoryDisabled}
            sub="Their conversations are deleted after each reply"
          />
        </div>

        {/* Recent accounts */}
        <h2 className="mb-3 mt-8 text-sm font-semibold">Recent accounts</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                <th className="px-4 py-2.5 font-medium">Account</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5 font-medium">Last active</th>
                <th className="px-4 py-2.5 text-right font-medium">Messages</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[var(--border-subtle)] last:border-b-0"
                >
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0">
                        <span className="block truncate">
                          {u.displayName || u.email.split("@")[0]}
                        </span>
                        <span className="block truncate text-xs text-[var(--text-secondary)]">
                          {u.email}
                        </span>
                      </span>
                      {u.isAdmin && (
                        <span className="bg-accent-soft shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                          Admin
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">
                    {u.lastActiveAt
                      ? new Date(u.lastActiveAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {u.messages}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-6 mt-6 flex items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] px-4 py-3">
          <ShieldCheck
            size={15}
            className="mt-0.5 shrink-0 text-[var(--text-secondary)]"
          />
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            This dashboard shows counts and trends only. It deliberately does not
            show message contents or conversation titles — titles are generated
            from what people write, so listing them would expose it. The privacy
            page tells users their conversations are not read, and this keeps
            that true.
          </p>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd className="tabular-nums font-medium">{value}</dd>
    </div>
  );
}
