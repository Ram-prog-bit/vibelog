"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ListVideo,
  ChartNoAxesColumn,
  Settings,
  BookOpen,
} from "lucide-react";
import { LIVE } from "@/lib/data";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/mission", label: "Mission control", icon: Activity },
  { href: "/sessions", label: "Sessions", icon: ListVideo },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesColumn },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/docs", label: "Docs", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-[218px] shrink-0 flex-col border-r border-line bg-surface max-md:hidden">
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded-full border-[1.5px] border-ink">
            <span className="size-1.5 rounded-full bg-rec" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">VibeLog</span>
        </Link>
        <ThemeToggle />
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors ${
                active
                  ? "bg-wash font-medium text-ink"
                  : "text-ink-2 hover:bg-wash/60 hover:text-ink"
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
              {href === "/sessions" && LIVE.length > 0 && (
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-rec">
                  <span className="size-1 rounded-full bg-rec animate-blink" />
                  {LIVE.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-line px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-3">Storage</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-2">
          <span className="size-1.5 rounded-full bg-ok" />
          Local · ~/.vibelog
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-ink-3">142 MB · nothing synced</div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-20 flex items-center gap-1 border-b border-line bg-surface px-3 py-2 md:hidden">
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        <Link href="/" className="mr-2 flex shrink-0 items-center gap-1.5 pl-1">
          <span className="grid size-4 place-items-center rounded-full border-[1.5px] border-ink">
            <span className="size-1 rounded-full bg-rec" />
          </span>
          <span className="text-sm font-semibold tracking-tight">VibeLog</span>
        </Link>
        {NAV.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs ${
                active ? "bg-wash font-medium text-ink" : "text-ink-2"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <ThemeToggle className="ml-2" />
    </nav>
  );
}
