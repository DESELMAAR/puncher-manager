"use client";

import { useApiLoadingStore } from "@/store/apiLoadingStore";

/**
 * Shown while any in-flight {@link api} request is pending (axios interceptors).
 * Raw `fetch()` calls should call {@link useApiLoadingStore.getState().begin}/`end` or use {@link withApiLoading}.
 */
export function GlobalApiLoading() {
  const pending = useApiLoadingStore((s) => s.pending);
  if (pending === 0) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[9998] h-[3px] overflow-hidden bg-emerald-950/15 dark:bg-emerald-500/10"
        role="progressbar"
        aria-busy="true"
        aria-valuetext="Loading"
      >
        <div className="global-api-loading-shimmer h-full w-full" />
      </div>
      <div className="pointer-events-none fixed left-1/2 top-3 z-[9997] flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-200/90 bg-white/95 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-md backdrop-blur-sm dark:border-zinc-600 dark:bg-zinc-900/95 dark:text-zinc-100">
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent dark:border-emerald-400"
          aria-hidden
        />
        <span>Loading…</span>
      </div>
    </>
  );
}
