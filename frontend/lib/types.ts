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
  recordDate: string;
  status: "ON_TIME" | "LATE" | "ABSENT" | null;
  expectedStart: string | null;
  actualStart: string | null;
  minutesLate: number | null;
  punches: PunchDto[];
}

export interface NotificationDto {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
  read: boolean;
  teamId: string | null;
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
}

export interface TeamDto {
  id: string;
  name: string;
  departmentId: string;
  teamLeaderId: string;
}
