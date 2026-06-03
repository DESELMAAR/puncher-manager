import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        pm: {
          surface: "var(--pm-surface)",
          border: "var(--pm-border)",
          muted: "var(--pm-muted)",
          accent: "var(--pm-accent)",
        },
      },
      boxShadow: {
        pm: "var(--pm-shadow)",
        "pm-lg": "var(--pm-shadow-lg)",
      },
      borderRadius: {
        pm: "var(--pm-radius)",
      },
    },
  },
  plugins: [],
  safelist: [
    "bg-rose-50",
    "dark:bg-rose-950",
    "bg-sky-50",
    "dark:bg-sky-950",
    "bg-emerald-50",
    "dark:bg-emerald-950",
    "bg-amber-50",
    "dark:bg-amber-950",
    "bg-violet-50",
    "dark:bg-violet-950",
    "bg-slate-100",
    "dark:bg-slate-900",
  ],
};
export default config;
