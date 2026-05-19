export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DEPT_MANAGER"
  | "TEAM_LEADER"
  | "EMPLOYEE";

export type PunchType =
  | "WORK_START"
  | "BREAK1_START"
  | "BREAK1_END"
  | "LUNCH_START"
  | "LUNCH_END"
  | "BREAK2_START"
  | "BREAK2_END"
  | "LOGOUT";

export interface LoginResponse {
  token: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId: string;
  departmentId: string | null;
  teamId: string | null;
}

export interface PunchDto {
  id: string;
  type: PunchType;
  punchedAt: string;
}

export interface AttendanceRow {
  userId: string;
  name: string;
  employeeId: string;
  email?: string | null;
  departmentName?: string | null;
  teamName?: string | null;
  deptManagerName?: string | null;
  deptManagerEmail?: string | null;
  teamLeaderName?: string | null;
  teamLeaderEmail?: string | null;
  recordDate: string;
  status: "ON_TIME" | "LATE" | "ABSENT" | null;
  expectedStart: string | null;
  actualStart: string | null;
  minutesLate: number | null;
  punches: PunchDto[];
  /** SUPER_ADMIN / ADMIN only: matches weekly schedule vs punches */
  scheduleVsPlanOk?: boolean | null;
  scheduleVsPlanNote?: string | null;
}

export interface AttendanceOverviewGroupDto {
  departmentId: string;
  departmentName: string;
  teamId: string;
  teamName: string;
  rows: AttendanceRow[];
}

export interface AttendanceAnalyticsPointDto {
  periodStart: string; // YYYY-MM-DD
  /** Share of records ON_TIME (solid blue segment). */
  onTimePct: number;
  latePct: number;
  absentPct: number;
  avgWorkHours: number | null;
  /** For late rows: sum(late minutes) / sum(work minutes), 0–100; null if not applicable. */
  lateTimeVsWorkPct: number | null;
}

export interface AttendanceLateEmployeeDto {
  userId: string;
  name: string;
  employeeId: string;
  departmentName: string | null;
  teamName: string | null;
  totalLateMinutes: number;
  lateDayCount: number;
}

export interface AttendanceLateDayDto {
  recordDate: string;
  minutesLate: number;
}

export interface AttendanceAbsentEmployeeDto {
  userId: string;
  name: string;
  employeeId: string;
  departmentName: string | null;
  teamName: string | null;
  absentDayCount: number;
  absentDates: string[];
}

export interface AttendanceAnalyticsResponseDto {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  totalRecords: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  presentPct: number;
  latePct: number;
  absentPct: number;
  avgWorkHours: number | null;
  daily: AttendanceAnalyticsPointDto[];
  weekly: AttendanceAnalyticsPointDto[];
  monthly: AttendanceAnalyticsPointDto[];
}

export interface CompanySettingsDto {
  id: string | null;
  companyName: string | null;
  postalAddress: string | null;
  departmentLabel: string | null;
  siteLocation: string | null;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  updatedAt: string | null;
}

export interface NotificationDto {
  id: string;
  senderId: string;
  senderName: string;
  type: string;
  message: string;
  payloadJson: string | null;
  createdAt: string;
  read: boolean;
  teamId: string | null;
}

export type ScheduleConfirmationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CORRECTION_REQUESTED";

export interface WeeklyScheduleDayDto {
  dayOfWeek: number; // 0=Sunday..6=Saturday
  dayOff: boolean;
  startTime: string | null; // HH:mm:ss
  endTime: string | null; // HH:mm:ss
}

export interface WeeklyScheduleResponse {
  scheduleId: string | null;
  employeeId: string;
  weekStart: string; // YYYY-MM-DD (Sunday)
  createdByUserId: string | null;
  updatedAt: string | null;
  days: WeeklyScheduleDayDto[];
  confirmationStatus: ScheduleConfirmationStatus;
  confirmationComment: string | null;
  respondedAt: string | null;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  phoneNumber: string | null;
  hiringDate: string | null;
  status: string;
  role: UserRole;
  departmentId: string | null;
  teamId: string | null;
}

export interface DepartmentDto {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  adminId: string | null;
  businessFirstStartHour?: number | null;
  businessLastStartHour?: number | null;
  lateGraceMinutes?: number | null;
  allowedLunchMinutes?: number | null;
  allowedBreaksMinutes?: number | null;
}

export interface TeamDto {
  id: string;
  name: string;
  departmentId: string;
  teamLeaderId: string;
}
