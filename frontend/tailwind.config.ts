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
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
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
    "bg-[rgb(211,218,217)]",
    "dark:bg-[#44444E]",
  ],
};
export default config;
