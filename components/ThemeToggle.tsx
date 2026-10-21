"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";

export default function ThemeToggle({
  variant = "icon",
  className = "",
}: {
  /** "icon" = 44px round button for headers; "nav" = labelled sidebar row. */
  variant?: "icon" | "nav";
  className?: string;
}) {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    // Read the class set by the pre-hydration inline script (app/layout.tsx) —
    // must happen post-mount so server and first client render both start `null`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const icon = isDark === null ? null : isDark ? <SunIcon size={21} /> : <MoonIcon size={21} />;

  if (variant === "nav") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className={`flex h-12 items-center gap-3.5 rounded-xl px-3 text-[15px] font-medium text-ink transition-colors hover:bg-surface-3 ${className}`}
      >
        <span className="flex h-[22px] w-[22px] items-center justify-center">{icon}</span>
        {isDark ? "Light mode" : "Dark mode"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-3 ${className}`}
    >
      {icon}
    </button>
  );
}
