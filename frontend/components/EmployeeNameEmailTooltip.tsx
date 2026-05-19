"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getActiveEmployeeEmailTooltip,
  setActiveEmployeeEmailTooltip,
  subscribeEmployeeEmailTooltip,
} from "@/lib/employeeEmailTooltipCoordinator";

const HIDE_DELAY_MS = 2000;

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export function EmployeeNameEmailTooltip({
  tooltipId,
  name,
  email,
}: {
  /** Unique per table row so only one tooltip is open at a time. */
  tooltipId: string;
  name: string;
  email?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailText = (email ?? "").trim();

  function clearHideTimer() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function closeTooltip() {
    clearHideTimer();
    setTooltipOpen(false);
  }

  useEffect(() => {
    return subscribeEmployeeEmailTooltip((active) => {
      if (active !== tooltipId) {
        clearHideTimer();
        setTooltipOpen(false);
      }
    });
  }, [tooltipId]);

  useEffect(() => () => clearHideTimer(), []);

  if (!emailText) {
    return <span className="font-medium">{name}</span>;
  }

  function onPointerEnter() {
    clearHideTimer();
    setActiveEmployeeEmailTooltip(tooltipId);
    setTooltipOpen(true);
  }

  function onPointerLeave() {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (getActiveEmployeeEmailTooltip() === tooltipId) {
        setActiveEmployeeEmailTooltip(null);
      }
      closeTooltip();
    }, HIDE_DELAY_MS);
  }

  async function onCopy(ev: React.MouseEvent) {
    ev.stopPropagation();
    ev.preventDefault();
    await copyText(emailText);
    setCopied(true);
    toast.success("Email copied");
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span
      className="relative inline-flex max-w-full"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <span className="cursor-default truncate font-medium underline decoration-dotted decoration-zinc-400/80 underline-offset-2 dark:decoration-zinc-500">
        {name}
      </span>
      {tooltipOpen ? (
        <span role="tooltip" className="absolute left-0 top-full z-[80] pt-1">
          <span className="flex max-w-[min(16rem,calc(100vw-2rem))] items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-200">
              {emailText}
            </span>
            <button
              type="button"
              onClick={(ev) => void onCopy(ev)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label={copied ? "Copied" : "Copy email"}
              title={copied ? "Copied" : "Copy email"}
            >
              {copied ? (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </span>
        </span>
      ) : null}
    </span>
  );
}
