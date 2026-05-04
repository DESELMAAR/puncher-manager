import { create } from "zustand";

type ApiLoadingState = {
  pending: number;
  begin: () => void;
  end: () => void;
};

export const useApiLoadingStore = create<ApiLoadingState>((set, get) => ({
  pending: 0,
  begin: () => set({ pending: get().pending + 1 }),
  end: () => set({ pending: Math.max(0, get().pending - 1) }),
}));

/** For raw `fetch()` or other non-axios calls so they use the same global indicator. */
export async function withApiLoading<T>(fn: () => Promise<T>): Promise<T> {
  useApiLoadingStore.getState().begin();
  try {
    return await fn();
  } finally {
    useApiLoadingStore.getState().end();
  }
}
