"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
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

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-lg shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-800"
    >
      {isDark === null ? null : isDark ? "☀️" : "🌙"}
    </button>
  );
}
