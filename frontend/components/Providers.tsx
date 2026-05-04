"use client";

import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { useUiStore, type BackgroundTheme } from "@/store/uiStore";
import { useI18nStore, type Language } from "@/store/i18nStore";
import { t } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const theme = useUiStore((s) => s.backgroundTheme);
  const setTheme = useUiStore((s) => s.setBackgroundTheme);
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const lang = useI18nStore((s) => s.lang);
  const setLang = useI18nStore((s) => s.setLang);

  useEffect(() => {
    if (!open && !langOpen) return;
    function onPointerDown(ev: PointerEvent) {
      const t = ev.target;
      if (!(t instanceof Node)) return;
      if (themeMenuRef.current?.contains(t)) return;
      if (langMenuRef.current?.contains(t)) return;
      setOpen(false);
      setLangOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, langOpen]);

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
          {dark ? t(lang, "theme.light") : t(lang, "theme.dark")}
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm shadow dark:border-zinc-600 dark:bg-zinc-800"
            aria-label="Background theme"
          >
            {t(lang, "theme.bg")}
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
                  ["DEFAULT", t(lang, "theme.bg.default")],
                  ["ROSE", t(lang, "theme.bg.rose")],
                  ["OCEAN", t(lang, "theme.bg.ocean")],
                  ["FOREST", t(lang, "theme.bg.forest")],
                  ["SUNSET", t(lang, "theme.bg.sunset")],
                  ["VIOLET", t(lang, "theme.bg.violet")],
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

        <div ref={langMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm shadow dark:border-zinc-600 dark:bg-zinc-800"
            aria-label="Language"
          >
            {lang.toUpperCase()}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`h-4 w-4 transition-transform ${langOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
          {langOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {(
                [
                  ["en", t(lang, "lang.english")],
                  ["fr", t(lang, "lang.french")],
                  ["es", t(lang, "lang.spanish")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setLang(id as Language);
                    setLangOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                    lang === id ? "font-semibold text-emerald-700 dark:text-emerald-300" : ""
                  }`}
                >
                  <span>{label}</span>
                  {lang === id && <span className="text-xs">✓</span>}
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
