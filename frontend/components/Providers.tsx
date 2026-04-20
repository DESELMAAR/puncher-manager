"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

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
      <button
        type="button"
        onClick={() => setDark((d) => !d)}
        className="fixed bottom-4 right-4 z-50 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm shadow dark:border-zinc-600 dark:bg-zinc-800"
        aria-label="Toggle dark mode"
      >
        {dark ? "Light" : "Dark"}
      </button>
      {children}
    </>
  );
}
