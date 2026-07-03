import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function NotFound() {
  return (
    <div className="relative grid min-h-screen place-items-center px-6">
      <ThemeToggle className="absolute top-6 right-6" />
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Nothing recorded here.</h1>
        <p className="mt-2 text-sm text-ink-2">
          The page you asked for doesn&apos;t exist, or the session was compacted by retention.
        </p>
        <Link
          href="/mission"
          className="mt-6 inline-block rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-85"
        >
          Back to mission control
        </Link>
      </div>
    </div>
  );
}
