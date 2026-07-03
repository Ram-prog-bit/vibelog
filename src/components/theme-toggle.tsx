"use client";

import { Sun, Moon } from "lucide-react";

const KEY = "vibelog-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem(KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line text-ink-2 transition-colors hover:border-line-2 hover:bg-wash hover:text-ink ${className}`}
    >
      <Sun size={14} strokeWidth={1.75} className="dark:hidden" />
      <Moon size={14} strokeWidth={1.75} className="hidden dark:block" />
    </button>
  );
}
