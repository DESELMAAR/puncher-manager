# Puncher Manager

Full-stack attendance and shift management system for a final-year project: **Spring Boot 3** (Java 17), **PostgreSQL**, **Next.js 14** (App Router), **JWT** security, role-based UI, mock planning API, nightly absence job, team notifications with **SSE**, and **CSV** attendance export.

## Repository layout

| Path | Description |
|------|-------------|
| `database/schema.sql` | PostgreSQL DDL (VARCHAR enums; aligns with JPA `EnumType.STRING`). |
| `backend/` | Spring Boot application (`./mvnw` not bundled; use local Maven). |
| `frontend/` | Next.js 14 + Tailwind + Zustand + Axios. |

## Entity-relationship overview (ERD)

- **users** — Core identity: email (unique), `employee_id` (unique), BCrypt `password`, `role`, `status`, optional `department_id` → **departments**, optional `team_id` → **teams**. Super Admin must not belong to a team (DB check in `schema.sql`).
- **departments** — `name`, `description`, `created_at`, optional `admin_id` → **users** (expected role: department manager).
- **teams** — `name`, `department_id` → **departments**, `team_leader_id` → **users**.
- **punches** — `user_id`, `punch_type`, `punched_at`; index on `(user_id, punched_at DESC)` for history and sequencing.
- **attendance_records** — One row per user per calendar day (`UNIQUE (user_id, record_date)`): `status` ON_TIME / LATE / ABSENT, `expected_start`, `actual_start`, `minutes_late`.
- **notifications** — `sender_id`, `receiver_id` (direct) or `team_id` (schema allows broadcast; the running app sends **one row per employee** for team messages so “read” is per person).

Relationships: Department 1—N Teams; Team N—1 Department; Team 1—1 TeamLeader (user); Employee N—1 Team; Punches and attendance_records N—1 User.

## Prerequisites

- **PostgreSQL** 14+ with database `puncher_manager` (or set env vars below).
- **Java 17+** (project builds without Lombok; tested with Maven on JDK 17–25).
- **Node.js 18+** for the frontend.

## Backend: configuration and run

Environment variables (optional; defaults in `application.yml`):

| Variable | Purpose |
|----------|---------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| `JWT_SECRET` | HMAC key for JWT (use a long random string in production) |
| `JWT_EXPIRATION_MS` | Default `28800000` (8 hours) |
| `CORS_ORIGINS` | Comma-separated origins; default `http://localhost:3000` |
| `SERVER_PORT` | Default `8080` |

Example (PowerShell):

```powershell
cd backend
$env:DB_PASSWORD = "your-postgres-password"
$env:JWT_SECRET = "replace-with-a-long-random-secret-at-least-32-chars"
mvn spring-boot:run
```

On first startup, **DataSeeder** creates (if no `superadmin@puncher.com` exists):

- `superadmin@puncher.com` / `admin123` — SUPER_ADMIN  
- `deptmgr@puncher.com` / `demo123` — DEPT_MANAGER (Engineering admin)  
- `teamlead@puncher.com` / `demo123` — TEAM_LEADER (Alpha Squad)  
- `employee@puncher.com` / `demo123` — EMPLOYEE (EMP001)

Hibernate `ddl-auto` is `update` for development (tables created automatically). For production, prefer Flyway/Liquibase and `validate`.

### API highlights

- `POST /api/auth/login` — JSON `{ "email", "password" }` → JWT + role.
- `POST /api/punch` — Employee only; body `{ "type", "timestamp?" }`; strict sequence validation.
- `GET /api/punch/my-history?from=&to=` — Employee.
- `GET /api/attendance/team/{teamId}?date=` — Leaders / dept / admins (scoped).
- `GET /api/attendance/team/{teamId}/export?date=` — CSV download (same auth as above).
- `POST /api/notification/send` — Team leader; `{ "teamId", "message" }`.
- `GET /api/notification/my`, `PATCH /api/notification/{id}/read`.
- `GET /api/notification/stream` — SSE; browsers can pass `?access_token=<JWT>` (header `Authorization` is still used for normal API calls).
- CRUD `/api/users`, `/api/departments`, `/api/teams` — Role rules enforced in services.
- `GET /api/planning/mock/{employeeId}/{date}` — Mock Mon–Fri 09:00–17:00 (public GET for demos; lock down in production).

Scheduled job: daily at **02:00** server time, marks **ABSENT** for active employees on planned working days with no punches and no existing attendance row.

## Frontend: configuration and run

```powershell
cd frontend
copy .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`. Login with seeded users above.

Features: role-based sidebar, punch pad with live refresh, history, notifications + SSE, team attendance table, CSV export (fetch with Bearer token), user list for admins, **dark/light** toggle (Tailwind `class` strategy).

## Optional / demo notes

- **PDF** export is not implemented; CSV is available for team leaders.
- **Real planning API**: replace `PlanningService` with an HTTP client calling your provider; keep contracts compatible with `PlanningResponseDto` / mock JSON shape.
- **Email** notifications: add Spring Mail and send on `NotificationService.sendToTeam` if required.

## License

Educational use (PFE).
