"use client";

import { useState } from "react";
import { AGENTS } from "@/lib/data";
import { PageHeader, Card } from "@/components/ui";

function Toggle({
  label,
  desc,
  defaultOn = true,
}: {
  label: string;
  desc: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 text-xs text-ink-2">{desc}</div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => setOn(!on)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
          on ? "bg-ink" : "bg-line-2"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-surface shadow-sm transition-transform ${
            on ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
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

const RATES = [
  { model: "claude-fable-5", inRate: "20.00", outRate: "90.00" },
  { model: "claude-opus-4-8", inRate: "15.00", outRate: "75.00" },
  { model: "claude-sonnet-5", inRate: "3.00", outRate: "15.00" },
  { model: "claude-haiku-4-5", inRate: "1.00", outRate: "5.00" },
];

export function SettingsForm() {
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" sub="Everything here stays in ~/.vibelog/config.json" />

      <Section title="Workspace">
        <div className="flex items-center justify-between gap-6 py-3.5">
          <div>
            <div className="text-sm font-medium">Storage location</div>
            <div className="mt-0.5 text-xs text-ink-2">Where session recordings are written</div>
          </div>
          <code className="rounded bg-wash px-2 py-1 font-mono text-xs text-ink-2">
            ~/.vibelog
          </code>
        </div>
        <div className="flex items-center justify-between gap-6 py-3.5">
          <div>
            <div className="text-sm font-medium">Retention</div>
            <div className="mt-0.5 text-xs text-ink-2">
              Sessions older than this are compacted to summaries
            </div>
          </div>
          <select
            aria-label="Retention"
            defaultValue="90"
            className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:outline-none"
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
            <option value="0">Forever</option>
          </select>
        </div>
      </Section>

      <Section title="Recording">
        <Toggle
          label="Capture prompt text"
          desc="Store the full text of every prompt, not just token counts"
        />
        <Toggle
          label="Capture model output"
          desc="Store assistant messages and reasoning summaries"
        />
        <Toggle
          label="Capture tool arguments"
          desc="Record the exact arguments passed to each tool call"
          defaultOn={false}
        />
        <Toggle
          label="Redact secrets"
          desc="Scrub values that match your .env keys before anything is written to disk"
        />
      </Section>

      <Section title="Pricing">
        <div className="py-3.5">
          <div className="mb-3 text-xs text-ink-2">
            Rates in USD per million tokens. Used everywhere a cost is shown.
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

      <Section title="Agents">
        {AGENTS.map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-6 py-3.5">
            <div>
              <div className="font-mono text-sm">{a.name}</div>
              <div className="mt-0.5 text-xs text-ink-2">{a.desc}</div>
            </div>
            <code className="rounded bg-wash px-2 py-1 font-mono text-[11px] text-ink-2">
              {a.model}
            </code>
          </div>
        ))}
      </Section>

      <Section title="Data">
        <div className="flex items-center justify-between gap-6 py-3.5">
          <div>
            <div className="text-sm font-medium">Export everything</div>
            <div className="mt-0.5 text-xs text-ink-2">
              One newline-delimited JSON file per session
            </div>
          </div>
          <button className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-wash">
            Export archive
          </button>
        </div>
        <div className="flex items-center justify-between gap-6 py-3.5">
          <div>
            <div className="text-sm font-medium text-rec">Delete all recordings</div>
            <div className="mt-0.5 text-xs text-ink-2">
              Removes ~/.vibelog entirely. There is no cloud copy to restore from.
            </div>
          </div>
          <button className="rounded-md border border-rec/30 px-3 py-1.5 text-xs font-medium text-rec hover:bg-rec-soft">
            Delete…
          </button>
        </div>
      </Section>
    </div>
  );
}
