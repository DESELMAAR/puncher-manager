import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Language = "en" | "fr" | "es";

type I18nState = {
  lang: Language;
  setLang: (l: Language) => void;
};

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      lang: "en",
      setLang: (l) => set({ lang: l }),
    }),
    { name: "puncher-lang" },
  ),
);

