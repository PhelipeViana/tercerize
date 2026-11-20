"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("tercerize_theme", "dark");
      } catch { }
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("tercerize_theme", "light");
      } catch { }
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={dark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/85 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
    >
      {dark ? (
        <Moon className="size-4 text-blue-300" aria-hidden="true" />
      ) : (
        <Sun className="size-4 text-slate-700" aria-hidden="true" />
      )}
    </button>
  );
}
