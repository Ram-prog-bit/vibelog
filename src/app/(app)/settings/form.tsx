"use client";

import { PageHeader, Card } from "@/components/ui";
import PRICING from "../../../../pricing.json";

// Nothing on this page is wired to storage yet, so unbuilt controls say so
// rather than pretending to hold a setting. A toggle that silently forgets is
// worse than no toggle — "Redact secrets" in particular used to default to ON
// while doing nothing, which misrepresented what lands in state.json.
function Soon() {
  return (
    <span className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">
      coming soon
    </span>
  );
}

function Pending({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div>
        <div className="text-sm font-medium text-ink-2">{label}</div>
        <div className="mt-0.5 text-xs text-ink-3">{desc}</div>
      </div>
      <Soon />
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

// Straight from pricing.json — the same file the recorder bills with, so this
// table can never drift from the numbers on the analytics page.
const RATES = Object.entries(PRICING.models).map(([model, r]) => ({
  model,
  inRate: r.in.toFixed(2),
  outRate: r.out.toFixed(2),
}));

export function SettingsForm() {
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" sub="What the recorder is doing on this machine" />

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
        <Pending
          label="Retention"
          desc="Compact sessions older than a cutoff. Today nothing is ever compacted; the collector keeps the 200 most recent sessions from the last 30 days."
        />
      </Section>

      <Section title="Recording">
        <div className="py-3.5 text-xs leading-relaxed text-ink-2">
          Prompt and assistant text are recorded to{" "}
          <code className="font-mono text-ink">~/.vibelog/state.json</code> in plain text, truncated
          to 280 characters per event. There is no redaction yet — treat that file as sensitive.
        </div>
        <Pending
          label="Capture controls"
          desc="Choose per-session whether prompt text, model output, and tool arguments are stored."
        />
        <Pending
          label="Redact secrets"
          desc="Scrub values matching your .env keys before anything is written to disk."
        />
      </Section>

      <Section title="Pricing">
        <div className="py-3.5">
          <div className="mb-3 text-xs text-ink-2">
            Rates in USD per million tokens, from pricing.json — used everywhere a cost is shown.
            Cache reads bill at {PRICING.cacheReadMultiplier}× input; cache writes at{" "}
            {PRICING.cacheWriteMultiplier}× input.
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
        <Pending
          label="Export everything"
          desc="One newline-delimited JSON file per session. Until then, ~/.vibelog/state.json is the whole dataset and is plain JSON."
        />
        <Pending
          label="Delete all recordings"
          desc="Until then, delete ~/.vibelog by hand. There is no cloud copy to restore from."
        />
      </Section>
    </div>
  );
}
