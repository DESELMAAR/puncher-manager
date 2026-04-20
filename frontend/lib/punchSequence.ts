import type { PunchDto, PunchType } from "./types";

export const PUNCH_ORDER: PunchType[] = [
  "WORK_START",
  "BREAK1_START",
  "BREAK1_END",
  "LUNCH_START",
  "LUNCH_END",
  "BREAK2_START",
  "BREAK2_END",
  "LOGOUT",
];

export function nextExpectedPunch(todayPunches: PunchDto[]): PunchType | null {
  if (todayPunches.length === 0) return "WORK_START";
  const sorted = [...todayPunches].sort(
    (a, b) => new Date(a.punchedAt).getTime() - new Date(b.punchedAt).getTime(),
  );
  const last = sorted[sorted.length - 1].type;
  if (last === "LOGOUT") return null;
  const idx = PUNCH_ORDER.indexOf(last);
  if (idx < 0 || idx >= PUNCH_ORDER.length - 1) return null;
  return PUNCH_ORDER[idx + 1];
}

export function labelPunch(t: PunchType): string {
  const map: Record<PunchType, string> = {
    WORK_START: "Start work",
    BREAK1_START: "Break 1 start",
    BREAK1_END: "Break 1 end",
    LUNCH_START: "Lunch start",
    LUNCH_END: "Lunch end",
    BREAK2_START: "Break 2 start",
    BREAK2_END: "Break 2 end",
    LOGOUT: "End shift",
  };
  return map[t];
}
