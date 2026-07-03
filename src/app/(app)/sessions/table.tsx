"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { SESSIONS, type SessionStatus } from "@/lib/data";
import { fmtUsd, fmtTokens, fmtDuration, timeAgo } from "@/lib/format";
import { PageHeader, Card, StatusLabel } from "@/components/ui";

const FILTERS: { key: SessionStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Recording" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
  { key: "queued", label: "Queued" },
];

export function SessionsTable() {
  const [filter, setFilter] = useState<SessionStatus | "all">("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return SESSIONS.filter(
      (s) =>
        (filter === "all" || s.status === filter) &&
        (!needle ||
          s.title.toLowerCase().includes(needle) ||
          s.id.toLowerCase().includes(needle) ||
          s.agent.toLowerCase().includes(needle) ||
          s.model.toLowerCase().includes(needle))
    );
  }, [filter, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        sub={`${SESSIONS.length} recorded on this machine`}
        right={
          <label className="relative block">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, id, model…"
              aria-label="Search sessions"
              className="w-60 rounded-md border border-line bg-surface py-1.5 pl-8 pr-3 text-[13px] placeholder:text-ink-3 focus:border-line-2 focus:outline-none"
            />
          </label>
        }
      />

      <div className="flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              filter === f.key
                ? "bg-ink text-paper"
                : "text-ink-2 hover:bg-wash"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-3">
              <th className="py-2.5 pl-4 pr-2 text-left font-normal">Status</th>
              <th className="px-2 py-2.5 text-left font-normal">Session</th>
              <th className="px-2 py-2.5 text-left font-normal max-lg:hidden">Agent</th>
              <th className="px-2 py-2.5 text-right font-normal max-md:hidden">Duration</th>
              <th className="px-2 py-2.5 text-right font-normal max-md:hidden">Tokens</th>
              <th className="px-2 py-2.5 text-right font-normal">Cost</th>
              <th className="py-2.5 pl-2 pr-4 text-right font-normal max-sm:hidden">Started</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 hover:bg-wash/40">
                <td className="whitespace-nowrap py-0 pl-4 pr-2 align-middle">
                  <StatusLabel status={s.status} />
                </td>
                <td className="max-w-0 w-full px-2 py-3">
                  <Link href={`/sessions/${s.id}`} className="block">
                    <span className="block truncate font-medium hover:underline underline-offset-2">
                      {s.title}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-3">
                      {s.id} · {s.branch}
                    </span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-2 py-3 font-mono text-[11px] text-ink-2 max-lg:hidden">
                  {s.agent}
                  <span className="text-ink-3"> · {s.model}</span>
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-[11px] tabular-nums text-ink-2 max-md:hidden">
                  {s.status === "queued" ? "—" : fmtDuration(s.durationSec)}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-[11px] tabular-nums text-ink-2 max-md:hidden">
                  {fmtTokens(s.tokensIn + s.tokensOut)}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-[11px] tabular-nums">
                  {fmtUsd(s.costUsd)}
                </td>
                <td className="whitespace-nowrap py-3 pl-2 pr-4 text-right font-mono text-[11px] tabular-nums text-ink-3 max-sm:hidden">
                  {timeAgo(s.startedAt)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-2">
                  No sessions match. Clear the search or pick another filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
