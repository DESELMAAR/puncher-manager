# Puncher Manager — Code Explanation (Backend + Frontend)

This document is a **human-readable walkthrough** of the main modules and data flows in your project.  
It’s written to help you understand “what calls what”, “why this exists”, and where to look when you want to change behavior.

---

## Backend (Spring Boot)

### Main concepts
- **Users** (`users` table): everybody who can sign in; has a `role`, optional `department`, optional `team`.
- **Teams** (`teams` table): each team belongs to one department and has one team leader.
- **Punches** (`punches` table): raw events (WORK_START, BREAKs, LUNCH, LOGOUT…).
- **Attendance records** (`attendance_records` table): derived daily summary (ON_TIME / LATE / ABSENT…).
- **Weekly schedules** (`weekly_schedules`, `weekly_schedule_days`, `schedule_confirmations`): planned working hours by week (Sun→Sat) with employee confirmation.
- **Company settings** (`company_settings`): singleton-style company info displayed at the top of the UI.

---

## Backend security & roles

### JWT auth
- Login creates a JWT token containing `uid`, `email`, `role`.
- Every API call (except `/api/auth/login` and Swagger) requires a valid token.

### Authorization rules (high-level)
- **SUPER_ADMIN / ADMIN**: broad organization access.
- **DEPT_MANAGER**: restricted to their department.
- **TEAM_LEADER**: restricted to their team.
- **EMPLOYEE**: personal endpoints only (punching, own history, own schedule view).

Look at:
- `backend/src/main/java/com/punchermanager/web/security/SecurityConfig.java`
- `backend/src/main/java/com/punchermanager/web/security/JwtAuthenticationFilter.java`

---

## Punch flow (most important)

### Endpoints
- `POST /api/punch` → create a punch
- `GET /api/punch/my-history?from=YYYY-MM-DD&to=YYYY-MM-DD` → list punches in a date range

### Key logic
File: `backend/src/main/java/com/punchermanager/service/PunchService.java`
- The backend enforces a **punch sequence** (WORK_START → BREAK1_START → BREAK1_END → … → LOGOUT).
- Exception: `WORK_START` is allowed at any time to “return to work” quickly.

### Timezone alignment (important)
The frontend sends civil dates like `2026-04-25` in the user’s browser timezone.  
The backend must build day windows using the same timezone, otherwise the “expected next punch” can mismatch.

That’s why requests include an `X-Client-Timezone` header, and backend resolves a `ZoneId` from it:
- `PunchService.resolveClientZone(...)`
- controller passes that zone to `punch(...)` and `myHistory(...)`

---

## Attendance flow

### Team attendance (single day)
- `GET /api/attendance/team/{teamId}?date=YYYY-MM-DD`

### Team attendance (range up to ~2 months)
- `GET /api/attendance/team/{teamId}?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Overview mode (all teams in scope)
- `GET /api/attendance/overview?date=...`
- `GET /api/attendance/overview?from=...&to=...`

### What a row contains
- `AttendanceRowDto` (backend) / `AttendanceRow` (frontend)
  - **Identity**: `name`, `employeeId`
  - **Date**: `recordDate`
  - **Status**: `ON_TIME` / `LATE` / `ABSENT` (may be computed)
  - **Punches**: array of punch events for the day
  - **Schedule vs punches**: `scheduleVsPlanOk`, `scheduleVsPlanNote` (shown to manager/admin viewers)

### How status is computed
File: `backend/src/main/java/com/punchermanager/service/AttendanceService.java`

There are two sources of truth for a day:
1. **Saved attendance record** (`attendance_records`) — typically written after `LOGOUT`.
2. **Derived status from punches** (when there is no record yet):
   - ON_TIME if `WORK_START` is at/before scheduled start time
   - LATE if `WORK_START` is after scheduled start time

This ensures the attendance table is meaningful even if the shift isn’t finished yet.

### Schedule vs punches verification
Also in `AttendanceService.verifyScheduleVsPunches(...)`:
- Uses `PlanningService.getPlannedDay(employeeId, date)` to get planned start/end.
- Checks:
  - day off vs punches
  - late start vs scheduled start (+grace)
  - end-of-shift comparisons only when `LOGOUT` exists

The note strings include the scheduled times and actual punch times to make audits clearer.

---

## Weekly schedules / confirmation

### Endpoints
- `GET /api/schedules/week?weekStart=YYYY-MM-DD[&employeeId=...]`
- `PUT /api/schedules/week` (managers)
- Confirmation flows:
  - `POST /api/schedules/{scheduleId}/send-confirmation`
  - `POST /api/schedules/{scheduleId}/respond`

### PlanningService integration
File: `backend/src/main/java/com/punchermanager/service/PlanningService.java`
- If a saved schedule exists, it’s used.
- If not, there’s a default mock: Mon–Fri 09:00–17:00, weekends off.

---

## Company settings

### Endpoints
- `GET /api/settings/company` (all roles)
- `PUT /api/settings/company` (SUPER_ADMIN only)
- `DELETE /api/settings/company` (SUPER_ADMIN only)

Stored in `company_settings` table. It’s treated as a singleton (latest row is returned).

---

## Frontend (Next.js)

### App skeleton
- The global layout is controlled by:
  - `frontend/components/Providers.tsx` (dark mode, background themes, language menu)
  - `frontend/components/AppShell.tsx` (sidebar navigation, refresh button, company header)

### Why the Refresh button remounts
Many pages fetch data using `useEffect`.  
So a normal “router refresh” won’t re-run those effects.  
The AppShell refresh increments a `refreshKey` and wraps the page content in a keyed `<div>` to force remount and refetch.

### API client
File: `frontend/lib/api.ts`
- Axios instance adds:
  - `Authorization: Bearer <token>`
  - `X-Client-Timezone: <IANA TZ>`

### Attendance UI
File: `frontend/app/(app)/team/page.tsx`
- Single team or overview mode
- Optional date range (2 months max)
- Search filter (name / employeeId; email once included in payload)
- Punches are shown as colored badges for readability
- Optional schedule-vs-plan indicator column for manager/admin roles

### Dashboard weekly schedule (employee)
File: `frontend/components/schedule/DashboardWeeklySchedule.tsx`
- Computes the current week’s Sunday using local calendar utilities
- Loads `/api/schedules/week` and shows Sun–Sat shifts

---

## Where to start reading (recommended order)
1. **Punching**: `PunchController` → `PunchService` → `PunchRepository`
2. **Attendance**: `AttendanceController` → `AttendanceService` → `PlanningService`
3. **Weekly schedule**: `ScheduleController` → `ScheduleService` → schedule entities
4. **Frontend shell**: `Providers` + `AppShell`, then each page.

