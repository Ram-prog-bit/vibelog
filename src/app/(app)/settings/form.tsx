"use client";

import { useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { useConfig, type Config } from "@/lib/config";
import PRICING from "../../../../pricing.json";

// Every control on this page reads and writes ~/.vibelog/config.json through
// /api/config. There is no save button: changes POST immediately and the
// collector picks them up on its next tick (~2s).

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
        on ? "border-ink bg-ink" : "border-line-2 bg-wash"
      }`}
    >
      <span
        className={`absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full transition-all ${
          on ? "left-[17px] bg-paper" : "left-[2px] bg-ink-3"
        }`}
      />
    </button>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 text-xs text-ink-2">{desc}</div>
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
      <h2 className="pt-1 text-sm font-medium">{title}</h2>
      <Card className="px-5 py-1.5 divide-y divide-line">{children}</Card>
    </section>
  );
}

const RETENTION: { days: number; label: string }[] = [
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
  { days: 0, label: "forever" },
];

// Toggle + dollar threshold in one row. 0 in config means off; the last
// nonzero amount is kept locally so switching off and back on doesn't reset it.
function AlertRow({
  label,
  desc,
  value,
  fallback,
  onChange,
}: {
  label: string;
  desc: string;
  value: number;
  fallback: number;
  onChange: (v: number) => void;
}) {
  const [amount, setAmount] = useState(value > 0 ? String(value) : String(fallback));
  const on = value > 0;
  return (
    <Row label={label} desc={desc}>
      <span className="flex shrink-0 items-center gap-3">
        <label
          className={`flex items-center gap-1 rounded-md border border-line px-2 py-1 font-mono text-xs transition-opacity ${
            on ? "" : "pointer-events-none opacity-40"
          }`}
        >
          $
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => {
              const v = Number(amount);
              if (v > 0) onChange(v);
              else setAmount(value > 0 ? String(value) : String(fallback));
            }}
            className="w-16 bg-transparent text-right tabular-nums focus:outline-none"
            aria-label={`${label} threshold in dollars`}
          />
        </label>
        <Toggle
          on={on}
          label={label}
          onChange={(v) => onChange(v ? Number(amount) > 0 ? Number(amount) : fallback : 0)}
        />
      </span>
    </Row>
  );
}

// Straight from pricing.json — the same file the recorder bills with, so this
// table can never drift from the numbers on the analytics page.
const RATES = Object.entries(PRICING.models).map(([model, r]) => ({
  model,
  inRate: r.in.toFixed(2),
  outRate: r.out.toFixed(2),
}));

export function SettingsForm() {
  const { config, save, saved } = useConfig();

  async function deleteAll() {
    if (
      !window.confirm(
        "Delete all recordings? This removes state.json and every remote session file from ~/.vibelog. There is no cloud copy to restore from."
      )
    )
      return;
    await fetch("/api/data", { method: "DELETE" });
    location.href = "/mission"; // reload into the empty state
  }

  if (!config)
    return (
      <div className="space-y-8">
        <PageHeader title="Settings" sub="What the recorder is doing on this machine" />
      </div>
    );

  const set = (patch: Partial<Config>) => save(patch);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        sub="What the recorder is doing on this machine · changes apply within a couple of seconds"
        right={
          <span
            role="status"
            className={`font-mono text-[11px] uppercase tracking-wider text-ink-3 transition-opacity duration-300 ${
              saved ? "opacity-100" : "opacity-0"
            }`}
          >
            Saved
          </span>
        }
      />

      <Section title="Workspace">
        <Row label="Storage location" desc="Where session recordings are written">
          <code className="rounded bg-wash px-2 py-1 font-mono text-xs text-ink-2">~/.vibelog</code>
        </Row>
        <Row
          label="Retention"
          desc="Sessions older than this are pruned from state.json on every collector tick"
        >
          <span className="inline-flex shrink-0 overflow-hidden rounded-md border border-line font-mono text-[10px] uppercase tracking-wider">
            {RETENTION.map((r, i) => (
              <button
                key={r.days}
                onClick={() => set({ retentionDays: r.days })}
                aria-pressed={config.retentionDays === r.days}
                className={`px-2.5 py-1 transition-colors ${
                  config.retentionDays === r.days ? "bg-wash text-ink" : "text-ink-3 hover:text-ink-2"
                } ${i > 0 ? "border-l border-line" : ""}`}
              >
                {r.label}
              </button>
            ))}
          </span>
        </Row>
      </Section>

      <Section title="Recording">
        <div className="py-3.5 text-xs leading-relaxed text-ink-2">
          Recordings go to <code className="font-mono text-ink">~/.vibelog/state.json</code> in
          plain text, truncated to 280 characters per event. The switches below control what the
          collector stores from the moment they change — already-recorded sessions are rewritten on
          its next pass.
        </div>
        <Row label="Prompt text" desc="Store what you asked. Off records the moment, not the words">
          <Toggle
            on={config.capturePrompts}
            label="Prompt text"
            onChange={(v) => set({ capturePrompts: v })}
          />
        </Row>
        <Row label="Model output" desc="Store assistant replies and summaries">
          <Toggle
            on={config.captureOutputs}
            label="Model output"
            onChange={(v) => set({ captureOutputs: v })}
          />
        </Row>
        <Row label="Tool arguments" desc="Store file paths and commands. Off keeps tool names only">
          <Toggle
            on={config.captureToolArgs}
            label="Tool arguments"
            onChange={(v) => set({ captureToolArgs: v })}
          />
        </Row>
        <Row
          label="Redact secrets"
          desc="Values from .env, .env.local and .env.production in a session's directory are replaced with [REDACTED]"
        >
          <Toggle
            on={config.redactSecrets}
            label="Redact secrets"
            onChange={(v) => set({ redactSecrets: v })}
          />
        </Row>
      </Section>

      <Section title="Alerts">
        <AlertRow
          label="Per-session alert"
          desc="Desktop notification when any live session crosses this amount"
          value={config.alertSessionUsd}
          fallback={5}
          onChange={(v) => set({ alertSessionUsd: v })}
        />
        <AlertRow
          label="Daily alert"
          desc="Desktop notification when today's total spend crosses this amount"
          value={config.alertDailyUsd}
          fallback={10}
          onChange={(v) => set({ alertDailyUsd: v })}
        />
        <div className="py-3.5 text-xs leading-relaxed text-ink-2">
          Alerts fire from the collector, once per session or day. If desktop notifications are
          blocked, the alert is printed to the terminal running{" "}
          <code className="font-mono text-ink">vibelog start</code> instead.
        </div>
      </Section>

      <Section title="Digest">
        <Row
          label="Generate weekly digest"
          desc="Every Monday morning, a markdown report of last week lands in ~/.vibelog/digests"
        >
          <Toggle
            on={config.weeklyDigest}
            label="Generate weekly digest"
            onChange={(v) => set({ weeklyDigest: v })}
          />
        </Row>
      </Section>

      <Section title="Pricing">
        <div className="py-3.5">
          <div className="mb-3 text-xs text-ink-2">
            Rates in USD per million tokens, from pricing.json — used everywhere a cost is shown.
            Cache reads bill at {PRICING.cacheReadMultiplier}× input; cache writes bill by TTL, at{" "}
            {PRICING.cacheWrite["1h"]}× input for a 1-hour cache and {PRICING.cacheWrite["5m"]}× for
            a 5-minute one. These are published list rates — a Max or Pro subscription does not bill
            this way, so every cost in the dashboard is an estimate.
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-3">
                <th className="pb-2 text-left font-normal">Model</th>
                <th className="pb-2 text-right font-normal">Input</th>
                <th className="pb-2 text-right font-normal">Output</th>
              </tr>
            </thead>
            <tbody>
              {RATES.map((r) => (
                <tr key={r.model} className="border-b border-line last:border-0">
                  <td className="py-2 font-mono text-xs">{r.model}</td>
                  <td className="py-2 text-right font-mono text-xs tabular-nums text-ink-2">
                    ${r.inRate}
                  </td>
                  <td className="py-2 text-right font-mono text-xs tabular-nums text-ink-2">
                    ${r.outRate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Data">
        <Row
          label="Export"
          desc="CSV, JSON, or Markdown, generated in your browser — use the Export button on the Sessions page or on any session"
        >
          <span />
        </Row>
        <Row
          label="Delete all recordings"
          desc="Removes state.json and all remote session files. Sessions recorded after deletion appear again"
        >
          <button
            onClick={deleteAll}
            className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-rec transition-colors hover:border-rec hover:bg-rec-soft"
          >
            Delete all
          </button>
        </Row>
      </Section>
    </div>
  );
}
