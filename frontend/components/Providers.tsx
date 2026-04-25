"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useUiStore, type BackgroundTheme } from "@/store/uiStore";

export function Providers({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const theme = useUiStore((s) => s.backgroundTheme);
  const setTheme = useUiStore((s) => s.setBackgroundTheme);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("puncher-theme");
    const prefersDark =
      saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  useEffect(() => {
    localStorage.setItem("puncher-theme", dark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <>
      <Toaster richColors position="top-right" closeButton />
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDark((d) => !d)}
          className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm shadow dark:border-zinc-600 dark:bg-zinc-800"
          aria-label="Toggle dark mode"
        >
          {dark ? "Light" : "Dark"}
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm shadow dark:border-zinc-600 dark:bg-zinc-800"
            aria-label="Background theme"
          >
            Bg
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
          {open && (
            <div className="absolute bottom-full right-0 mb-2 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {(
                [
                  ["DEFAULT", "Default"],
                  ["ROSE", "Rose"],
                  ["OCEAN", "Ocean"],
                  ["FOREST", "Forest"],
                  ["SUNSET", "Sunset"],
                  ["VIOLET", "Violet"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTheme(id as BackgroundTheme);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                    theme === id ? "font-semibold text-emerald-700 dark:text-emerald-300" : ""
                  }`}
                >
                  <span>{label}</span>
                  {theme === id && <span className="text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {children}
    </>
  );
}
