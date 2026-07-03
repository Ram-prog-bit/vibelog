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

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line-2 bg-wash px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
      {children}
    </kbd>
  );
}
