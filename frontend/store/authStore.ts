import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "@/lib/types";

type AuthState = {
  token: string | null;
  userId: string | null;
  name: string | null;
  email: string | null;
  role: UserRole | null;
  employeeId: string | null;
  departmentId: string | null;
  teamId: string | null;
  setAuth: (p: {
    token: string;
    userId: string;
    name: string;
    email: string;
    role: UserRole;
    employeeId: string;
    departmentId: string | null;
    teamId: string | null;
  }) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      name: null,
      email: null,
      role: null,
      employeeId: null,
      departmentId: null,
      teamId: null,
      setAuth: (p) => set({ ...p }),
      clear: () =>
        set({
          token: null,
          userId: null,
          name: null,
          email: null,
          role: null,
          employeeId: null,
          departmentId: null,
          teamId: null,
        }),
    }),
    { name: "puncher-auth" },
  ),
);
