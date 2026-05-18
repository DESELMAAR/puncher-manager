import type { BackgroundTheme } from "@/store/uiStore";

/** Tailwind classes for the app shell wrapper (full viewport). */
export function backgroundShellClass(theme: BackgroundTheme): string {
  switch (theme) {
    case "ROSE":
      return "bg-rose-50 dark:bg-rose-950";
    case "OCEAN":
      return "bg-sky-50 dark:bg-sky-950";
    case "FOREST":
      return "bg-emerald-50 dark:bg-emerald-950";
    case "SUNSET":
      return "bg-amber-50 dark:bg-amber-950";
    case "VIOLET":
      return "bg-violet-50 dark:bg-violet-950";
    case "DEFAULT":
    default:
      return "bg-[rgb(211,218,217)] dark:bg-[#44444E]";
  }
}

/** Sets `data-bg-theme` on `<html>` so `globals.css` can paint `body` too. */
export function applyBackgroundThemeToDocument(theme: BackgroundTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.bgTheme = theme;
}
