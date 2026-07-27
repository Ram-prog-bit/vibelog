"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { Session } from "@/lib/data";
import { FORMATS, type ExportFormat, downloadExport } from "@/lib/export";

// Export button + modal. Files are generated client-side from the sessions
// already streaming to the page — no server involved. `single` (session
// detail page) exports that one session and hides the date range.

export function ExportButton({
  sessions,
  single = false,
}: {
  sessions: Session[];
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>(single ? "md" : "csv");
  const [from, setFrom] = useState(""); // yyyy-mm-dd, empty = unbounded
  const [to, setTo] = useState("");

  const filtered = single
    ? sessions
    : sessions.filter(
        (s) =>
          (!from || s.startedAt >= new Date(from + "T00:00:00").getTime()) &&
          (!to || s.startedAt <= new Date(to + "T23:59:59.999").getTime())
      );

  const go = () => {
    downloadExport(
      filtered,
      format,
      single && sessions[0]
        ? `vibelog-${sessions[0].id}`
        : `vibelog-export-${new Date().toISOString().slice(0, 10)}`
    );
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
      >
        <Download size={13} />
        Export
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/20 p-4 pt-[18vh] backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-label="Export sessions"
            className="mx-auto w-full max-w-sm rounded-xl border border-line-2 bg-surface p-5 shadow-2xl"
          >
            <h2 className="text-sm font-semibold tracking-tight">
              {single ? "Export this session" : "Export sessions"}
            </h2>

            <div className="mt-4">
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">
                Format
              </div>
              <div className="inline-flex overflow-hidden rounded-md border border-line font-mono text-[11px]">
                {(Object.keys(FORMATS) as ExportFormat[]).map((f, i) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    aria-pressed={format === f}
                    className={`px-3 py-1.5 transition-colors ${
                      format === f ? "bg-wash text-ink" : "text-ink-3 hover:text-ink-2"
                    } ${i > 0 ? "border-l border-line" : ""}`}
                  >
                    {FORMATS[f].label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-ink-3">
                {format === "csv"
                  ? "One row per session — opens in Excel."
                  : format === "json"
                    ? "Full session data including every event."
                    : "Readable summary — good for changelogs."}
              </p>
            </div>

            {!single && (
              <div className="mt-4">
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">
                  Date range
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    aria-label="From date"
                    className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink-2 focus:border-line-2 focus:outline-none"
                  />
                  <span className="text-xs text-ink-3">to</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    aria-label="To date"
                    className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink-2 focus:border-line-2 focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 text-xs text-ink-3">Leave blank for everything loaded.</p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md px-2.5 py-1.5 text-xs text-ink-3 hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={go}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-opacity disabled:opacity-40"
              >
                <Download size={13} />
                Download{" "}
                {single ? "" : `${filtered.length} ${filtered.length === 1 ? "session" : "sessions"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
