import type { SessionStatus } from "@/lib/data";

export function StatusDot({ status }: { status: SessionStatus }) {
  const cls =
    status === "live"
      ? "bg-rec animate-blink"
      : status === "completed"
        ? "bg-ok"
        : status === "failed"
          ? "bg-ink-3"
          : "bg-warn";
  return <span aria-hidden className={`inline-block size-1.5 rounded-full ${cls}`} />;
}

export function StatusLabel({ status }: { status: SessionStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-2">
      <StatusDot status={status} />
      {status === "live" ? "recording" : status}
    </span>
  );
}

// Three dashes fed across like tape through a reel — our loading/thinking mark.
// active=false leaves them at rest (three clean dashes) for historical rows.
export function TapeReel({
  active = true,
  className = "",
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden className={`inline-flex items-center gap-[3px] align-middle ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-px w-[7px] rounded-full bg-current"
          style={
            active
              ? { animation: "reel 1.05s ease-in-out infinite", animationDelay: `${i * 0.14}s` }
              : undefined
          }
        />
      ))}
    </span>
  );
}

// Shown whenever the dashboard is rendering built-in demo data. The mode chip
// alone was far too quiet: a fresh install with zero recordings showed a busy,
// fully populated dashboard that read as the user's own sessions.
export function DemoBanner() {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line-2 bg-wash px-4 py-2.5"
    >
      <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink">
        <span className="size-1.5 rounded-full bg-warn" />
        Demo data
      </span>
      <span className="text-[13px] text-ink-2">
        These sessions are simulated. Run{" "}
        <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-ink">
          vibelog start
        </code>{" "}
        to see your real ones.
      </span>
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-2">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-2">{hint}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-line bg-surface ${className}`}>{children}</div>
  );
}

// The house empty state: typography only, serif italic headline, muted subtext.
// `tape` draws a flat recorder strip above it — no spikes, ready and waiting.
export function EmptyState({
  title,
  sub,
  code,
  tape = false,
  className = "",
}: {
  title: string;
  sub: string;
  code?: string;
  tape?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center py-20 text-center ${className}`}>
      {tape && (
        <svg viewBox="0 0 720 40" className="mb-10 w-full max-w-lg" aria-hidden>
          {Array.from({ length: 25 }, (_, i) => (
            <line
              key={i}
              x1={6 + (i / 24) * 708}
              x2={6 + (i / 24) * 708}
              y1={33}
              y2={36}
              stroke="var(--color-line-2)"
              strokeWidth={1}
            />
          ))}
          <line x1={0} x2={720} y1={28} y2={28} stroke="var(--color-line-2)" strokeWidth={1} />
        </svg>
      )}
      <p className="font-serif text-2xl italic tracking-tight">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">{sub}</p>
      {code && (
        <code className="mt-6 rounded-md bg-code-bg px-3 py-1.5 font-mono text-xs text-code-fg">
          {code}
        </code>
      )}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line-2 bg-wash px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
      {children}
    </kbd>
  );
}
