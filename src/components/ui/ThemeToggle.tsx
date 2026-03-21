"use client";

import { useState, useEffect } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  function cycle() {
    const next =
      theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  const icon =
    theme === "dark"
      ? "\u263E" // moon
      : theme === "light"
        ? "\u2600" // sun
        : "\u25D1"; // half circle (system)

  return (
    <button
      onClick={cycle}
      className="w-8 h-8 rounded-md flex items-center justify-center
        text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm"
      title={`Theme: ${theme}`}
      aria-label={`Switch theme (current: ${theme})`}
    >
      {icon}
    </button>
  );
}
