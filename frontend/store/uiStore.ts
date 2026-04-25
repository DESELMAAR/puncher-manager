import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BackgroundTheme =
  | "DEFAULT"
  | "ROSE"
  | "OCEAN"
  | "FOREST"
  | "SUNSET"
  | "VIOLET";

type UiState = {
  backgroundTheme: BackgroundTheme;
  setBackgroundTheme: (t: BackgroundTheme) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      backgroundTheme: "DEFAULT",
      setBackgroundTheme: (t) => set({ backgroundTheme: t }),
    }),
    { name: "puncher-ui" },
  ),
);

