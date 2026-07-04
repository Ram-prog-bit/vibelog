"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, GitBranch, FolderGit2 } from "lucide-react";
import { type Session, type SessionStatus } from "@/lib/data";
import { useLive } from "@/lib/live";
import { fmtUsd6, fmtTokens, fmtDuration, timeAgo } from "@/lib/format";
import { PageHeader, Card, StatusLabel } from "@/components/ui";

const FILTERS: { key: SessionStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Recording" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
  { key: "queued", label: "Queued" },
];

type GroupBy = "session" | "project" | "branch";
const GROUPS: { key: GroupBy; label: string }[] = [
  { key: "session", label: "By session" },
  { key: "project", label: "By project" },
  { key: "branch", label: "By branch" },
];

// A flat list of things to render into one table: group headers (with rolled-up
// totals) interleaved with the session rows they cover. Keeps a single table
// layout for all three views instead of three bespoke ones.
type Row =
  | { kind: "session"; s: Session }
  | {
      kind: "header";
      level: 0 | 1; // 0 = project/branch, 1 = branch nested under a project
      icon: "project" | "branch";
      label: string;
      cost: number;
      tokens: number;
      count: number;
    };

const agg = (rows: Session[]) => ({
  cost: rows.reduce((a, s) => a + s.costUsd, 0),
  tokens: rows.reduce((a, s) => a + s.tokensIn + s.tokensOut, 0),
  count: rows.length,
});

// Group into [key, sessions][] preserving first-seen order (sessions arrive
// newest-first from the CLI, so groups read most-recent-first).
function groupBy<T>(items: Session[], key: (s: Session) => T): [T, Session[]][] {
  const map = new Map<T, Session[]>();
  for (const s of items) {
    const k = key(s);
    (map.get(k) ?? map.set(k, []).get(k)!).push(s);
  }
  return [...map.entries()];
}

function buildRows(sessions: Session[], group: GroupBy): Row[] {
  if (group === "session") return sessions.map((s) => ({ kind: "session", s }));

  if (group === "branch") {
    return groupBy(sessions, (s) => s.gitBranch || "no-branch").flatMap(
      ([branch, rows]): Row[] => [
        { kind: "header", level: 0, icon: "branch", label: branch, ...agg(rows) },
        ...rows.map((s): Row => ({ kind: "session", s })),
      ]
    );
  }

  // by project → branches nested under each project; untracked bucket last
  const projects = groupBy(sessions, (s) => s.projectId ?? "__untracked__");
  return projects.flatMap(([, rows]): Row[] => {
    const name = rows[0].projectName || "Untracked";
    const branches = groupBy(rows, (s) => s.gitBranch || "no-branch");
    return [
      { kind: "header", level: 0, icon: "project", label: name, ...agg(rows) },
      ...branches.flatMap(([branch, brows]): Row[] => [
        { kind: "header", level: 1, icon: "branch", label: branch, ...agg(brows) },
        ...brows.map((s): Row => ({ kind: "session", s })),
      ]),
    ];
  });
}

export function SessionsTable() {
  const { sessions, now } = useLive();
  const [filter, setFilter] = useState<SessionStatus | "all">("all");
  const [group, setGroup] = useState<GroupBy>("session");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = sessions.filter(
      (s) =>
        (filter === "all" || s.status === filter) &&
        (!needle ||
          s.title.toLowerCase().includes(needle) ||
          s.id.toLowerCase().includes(needle) ||
          s.agent.toLowerCase().includes(needle) ||
          s.model.toLowerCase().includes(needle) ||
          (s.gitBranch ?? "").toLowerCase().includes(needle) ||
          (s.projectName ?? "").toLowerCase().includes(needle))
    );
    return buildRows(filtered, group);
  }, [sessions, filter, q, group]);

  const sessionCount = rows.filter((r) => r.kind === "session").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        sub={`${sessions.length} recorded on this machine`}
        right={
          <label className="relative block">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, id, model, branch…"
              aria-label="Search sessions"
              className="w-60 rounded-md border border-line bg-surface py-1.5 pl-8 pr-3 text-[13px] placeholder:text-ink-3 focus:border-line-2 focus:outline-none"
            />
          </label>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                filter === f.key ? "bg-ink text-paper" : "text-ink-2 hover:bg-wash"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-line font-mono text-[10px] uppercase tracking-wider">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => setGroup(g.key)}
              aria-pressed={group === g.key}
              className={`px-2.5 py-1 transition-colors ${
                group === g.key ? "bg-wash text-ink" : "text-ink-3 hover:text-ink-2"
              } ${g.key !== "session" ? "border-l border-line" : ""}`}
            >
              {g.label}
            </button>
          ))}
        </div>
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
            {rows.map((r, i) =>
              r.kind === "header" ? (
                <tr
                  key={`h-${i}`}
                  className={r.level === 0 ? "bg-wash/60" : "bg-wash/25"}
                >
                  <td colSpan={7} className={r.level === 0 ? "px-4 py-2" : "py-1.5 pl-8 pr-4"}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        {r.icon === "project" ? (
                          <FolderGit2 size={13} className="shrink-0 text-ink-3" />
                        ) : (
                          <GitBranch size={12} className="shrink-0 text-ink-3" />
                        )}
                        <span
                          className={`truncate ${
                            r.level === 0 ? "font-medium" : "font-mono text-[12px] text-ink-2"
                          }`}
                        >
                          {r.label}
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums text-ink-3">
                        {r.count} {r.count === 1 ? "session" : "sessions"} ·{" "}
                        {fmtTokens(r.tokens)} tok · {fmtUsd6(r.cost)}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr
                  key={r.s.id}
                  className="border-b border-line last:border-0 hover:bg-wash/40"
                >
                  <td className="whitespace-nowrap py-0 pl-4 pr-2 align-middle">
                    <StatusLabel status={r.s.status} />
                  </td>
                  <td className="max-w-0 w-full px-2 py-3">
                    <Link href={`/sessions/${r.s.id}`} className="block">
                      <span className="block truncate font-medium hover:underline underline-offset-2">
                        {r.s.title}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-3">
                        {r.s.id} · {r.s.gitBranch || "no-branch"}
                      </span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 font-mono text-[11px] text-ink-2 max-lg:hidden">
                    {r.s.agent}
                    <span className="text-ink-3"> · {r.s.model}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-[11px] tabular-nums text-ink-2 max-md:hidden">
                    {r.s.status === "queued" ? "—" : fmtDuration(r.s.durationSec)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-[11px] tabular-nums text-ink-2 max-md:hidden">
                    {fmtTokens(r.s.tokensIn + r.s.tokensOut)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-[11px] tabular-nums">
                    {fmtUsd6(r.s.costUsd)}
                  </td>
                  <td className="whitespace-nowrap py-3 pl-2 pr-4 text-right font-mono text-[11px] tabular-nums text-ink-3 max-sm:hidden">
                    {timeAgo(r.s.startedAt, now)}
                  </td>
                </tr>
              )
            )}
            {sessionCount === 0 && (
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
