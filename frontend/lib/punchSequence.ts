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

export type ActiveStatus =
  | { kind: "NOT_STARTED" }
  | { kind: "WORKING"; since: string }
  | { kind: "BREAK_1"; since: string }
  | { kind: "LUNCH"; since: string }
  | { kind: "BREAK_2"; since: string }
  | { kind: "SHIFT_ENDED"; since: string };

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

export function resolveActiveStatus(todayPunches: PunchDto[]): ActiveStatus {
  if (todayPunches.length === 0) return { kind: "NOT_STARTED" };
  const sorted = [...todayPunches].sort(
    (a, b) => new Date(a.punchedAt).getTime() - new Date(b.punchedAt).getTime(),
  );
  const last = sorted[sorted.length - 1];
  switch (last.type) {
    case "WORK_START":
    case "BREAK1_END":
    case "LUNCH_END":
    case "BREAK2_END":
      return { kind: "WORKING", since: last.punchedAt };
    case "BREAK1_START":
      return { kind: "BREAK_1", since: last.punchedAt };
    case "LUNCH_START":
      return { kind: "LUNCH", since: last.punchedAt };
    case "BREAK2_START":
      return { kind: "BREAK_2", since: last.punchedAt };
    case "LOGOUT":
      return { kind: "SHIFT_ENDED", since: last.punchedAt };
    default:
      return { kind: "NOT_STARTED" };
  }
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

export function labelStatus(s: ActiveStatus): string {
  switch (s.kind) {
    case "NOT_STARTED":
      return "Not started";
    case "WORKING":
      return "On work";
    case "BREAK_1":
      return "Break 1";
    case "LUNCH":
      return "Lunch";
    case "BREAK_2":
      return "Break 2";
    case "SHIFT_ENDED":
      return "Shift ended";
  }
}
