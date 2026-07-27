"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useLive } from "@/lib/live";
import { searchSessions } from "@/lib/search";
import { fmtUsd6, dateShort } from "@/lib/format";

import { Kbd, StatusDot } from "@/components/ui";

// Cmd/Ctrl+K search palette, mounted once in the app layout so it opens from
// anywhere. Searches everything the recorder stores — titles, prompts, tool
// arguments, outputs, models, branches, projects — via src/lib/search.ts.

export function SearchPalette() {
  const router = useRouter();
  const { sessions } = useLive();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState(""); // q, debounced 300ms
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDq(q);
      setActive(0); // new results, restart selection at the top
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) return null;

  const hits = searchSessions(sessions, dq);
  const go = (id: string) => {
    setOpen(false);
    setQ("");
    setDq("");
    router.push(`/sessions/${id}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/20 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-label="Search sessions"
        className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-line-2 bg-surface shadow-2xl"
      >
        <label className="relative block border-b border-line">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && hits[active]) {
                go(hits[active].session.id);
              }
            }}
            placeholder="Search prompts, files, commands, models…"
            aria-label="Search all sessions"
            className="w-full bg-transparent py-3.5 pl-11 pr-4 text-[15px] placeholder:text-ink-3 focus:outline-none"
          />
        </label>

        {dq.trim() === "" ? (
          <div className="px-4 py-10 text-center text-sm text-ink-2">
            Search across your entire Claude history
          </div>
        ) : hits.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-ink-2">
            No matches for <span className="font-mono text-ink">“{dq.trim()}”</span>
          </div>
        ) : (
          <ul ref={listRef} className="max-h-[50vh] overflow-y-auto py-1.5">
            {hits.map((h, i) => (
              <li key={h.session.id}>
                <button
                  onClick={() => go(h.session.id)}
                  onMouseEnter={() => setActive(i)}
                  ref={(el) => {
                    if (i === active) el?.scrollIntoView({ block: "nearest" });
                  }}
                  className={`block w-full px-4 py-2.5 text-left ${
                    i === active ? "bg-wash" : ""
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <StatusDot status={h.session.status} />
                      <span className="truncate text-sm font-medium">{h.session.title}</span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-mono text-[10px] tabular-nums text-ink-3">
                      {fmtUsd6(h.session.costUsd)} · {dateShort(h.session.startedAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-3">
                    {h.before}
                    <mark className="rounded-sm bg-rec-soft px-0.5 text-ink">{h.match}</mark>
                    {h.after}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 border-t border-line px-4 py-2 font-mono text-[10px] text-ink-3">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
          </span>
          <span>
            <Kbd>↵</Kbd> open
          </span>
          <span>
            <Kbd>esc</Kbd> close
          </span>
          <span className="ml-auto">{sessions.length} sessions indexed</span>
        </div>
      </div>
    </div>
  );
}
