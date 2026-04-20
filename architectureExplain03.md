# Architecture — Puncher Manager

This document describes the **high-level architecture**: how layers interact, how security and data flow work, and how major features fit together. It complements the SQL schema (`database/schema.sql`) and the runnable code in `backend/` and `frontend/`.

---

## 1. System context

```
┌─────────────┐      HTTPS/HTTP       ┌─────────────────┐      JDBC       ┌──────────────┐
│   Browser   │ ◄──────────────────► │  Next.js (UI)   │               │              │
│  (employee, │      (pages, axios)    │  port 3000      │               │              │
│   manager)  │                        └────────┬────────┘               │              │
└──────┬──────┘                                 │                        │  PostgreSQL  │
       │                                        │ JWT Bearer             │  port 5432   │
       │              REST + JSON               ▼                        │              │
       └────────────────────────────────► ┌─────────────────┐ ───────────► │  puncher_    │
                                          │ Spring Boot API │             │  manager DB  │
                                          │ port 8080       │             │              │
                                          └────────┬────────┘             └──────────────┘
                                                   │
                                                   │ optional future
                                                   ▼
                                          ┌─────────────────┐
                                          │ External        │
                                          │ Planning API    │
                                          └─────────────────┘
```

- **Users** interact only with the **Next.js** application in the browser.
- The **browser** sends authenticated requests **directly to the Spring Boot API** (Axios base URL). The Next.js server does not proxy API calls unless you add that later.
- **PostgreSQL** holds all persistent state.
- The **mock planning API** is implemented **inside** Spring Boot today; later you can replace `PlanningService` with an HTTP client to a real provider without changing the UI contract.

---

## 2. Backend architecture (Spring Boot)

### 2.1 Layered structure

| Layer | Package / area | Responsibility |
|--------|----------------|----------------|
| **Web** | `web.controller` | HTTP mapping, validation on DTOs, delegates to services. |
| **DTO** | `web.dto` | Request/response shapes; decouples JSON from JPA entities. |
| **Security** | `web.security` | `SecurityFilterChain`, JWT filter, CORS, password encoding (BCrypt). |
| **Domain** | `domain` | JPA **entities**: `User`, `Department`, `Team`, `Punch`, `AttendanceRecord`, `NotificationEntity`. |
| **Persistence** | `repository` | Spring Data JPA repositories. |
| **Business logic** | `service` | Punch sequencing, attendance evaluation, notifications, RBAC checks. |
| **Scheduling** | `schedule` | Nightly absence evaluation. |
| **Bootstrap** | `bootstrap` | Seeds default users on empty database. |

This follows a classic **controller → service → repository** flow with a **domain model** in the center.

---

### 2.2 Security model

1. **Login:** `POST /api/auth/login` accepts email/password, verifies BCrypt hash, issues **JWT** (claims: user id, email, role).
2. **Requests:** `JwtAuthenticationFilter` reads `Authorization: Bearer <token>` (and optionally `access_token` on the notification SSE path for browser limitations).
3. **Authorization:** Method-level `@PreAuthorize` (e.g. `hasRole('EMPLOYEE')`) plus **explicit checks** in services (e.g. team leader may only manage their team).

JWT expiration is configurable (`JWT_EXPIRATION_MS`, default 8 hours).

---

### 2.3 Core domain flows

**Punch workflow**

1. Employee posts punches in strict order for a given **calendar day** (timezone: JVM default / system zone in services).
2. On **LOGOUT**, if planning says it is a working day, **attendance** is computed: compare first **WORK_START** time to planned start; within 10 minutes → `ON_TIME`, else `LATE`.

**Absence workflow**

1. Scheduled job runs daily (e.g. 02:00).
2. For each **active employee**, if the plan defines a working day and there are **no punches** and **no existing attendance row**, insert **`ABSENT`**.

**Notifications**

1. Team leader sends a message for a **team**.
2. Backend creates **one notification per employee** (per-user read state).
3. **SSE** broadcasts to connected user channels for near–real-time updates.

---

### 2.4 Integration point: Planning

- **`PlanningService`** encapsulates “expected hours for date.”
- Today it is **deterministic mock** (Mon–Fri, fixed times).
- Swapping in a real service means: keep the same conceptual output (expected start/end, whether the day is a working day) and reuse `AttendanceService` / scheduler without changing controllers.

---

## 3. Frontend architecture (Next.js 14)

| Area | Purpose |
|------|---------|
| **App Router** (`app/`) | Routes: `/login`, protected group `(app)/…` for dashboard, punch, history, etc. |
| **Client state** | Zustand `authStore` (persisted): JWT + role + ids for menu and API scope. |
| **HTTP client** | Axios instance (`lib/api.ts`) attaches `Authorization` from the store. |
| **UI** | Tailwind CSS; role-based sidebar in `AppShell`; dark mode via `class` on `<html>`. |

There is **no server-side session store** in Node; the source of truth for authentication is the **JWT** stored client-side (acceptable for many academic / internal apps; production might add httpOnly cookies and CSRF strategy).

---

## 4. Data model (conceptual ER)

- **User** — roles, optional **Department** and **Team** links.
- **Department** — optional **admin** (`DEPT_MANAGER`).
- **Team** — belongs to **Department**; has **TeamLeader** (`User`).
- **Punch** — belongs to **User**; ordered by timestamp for business rules.
- **AttendanceRecord** — one row per **User** per **date** (unique constraint).
- **Notification** — sender + receiver (team sends fan out to receivers).

Detailed columns and indexes are in **`database/schema.sql`**.

---

## 5. Cross-cutting concerns

| Concern | Implementation |
|---------|----------------|
| **Validation** | Jakarta Validation on DTOs; extra rules in services. |
| **Errors** | `GlobalExceptionHandler` returns JSON with `message`, `status`, `timestamp`. |
| **Logging** | SLF4J (Spring default); package `com.punchermanager` at INFO. |
| **CORS** | Configured for `CORS_ORIGINS` (e.g. `http://localhost:3000`). |

---

## 6. Deployment shapes (mental model)

| Shape | Description |
|-------|-------------|
| **Dev** | Postgres local or Docker; API and Next.js on host with hot reload. |
| **Compose** | Three containers (Postgres + API + UI) on one host; see **`runEplanation02.md`**. |
| **Prod** | Split services: managed Postgres, API behind TLS, UI on CDN or same domain behind reverse proxy; inject secrets via env/secrets manager; rotate `JWT_SECRET`. |

---

## 7. Related documents

| File | Content |
|------|---------|
| `endpointTest01.md` | Postman-oriented API testing for every endpoint. |
| `runEplanation02.md` | Local and Docker run instructions for DB, API, and UI. |
| `README.md` | Quick start and seed accounts. |

---

## 8. Organization structure and role hierarchy

This section describes how **departments**, **teams**, and **roles** fit together for administration and day-to-day HR boundaries.

### 8.1 Role ladder (within the org)

For operational boundaries (not platform-wide RBAC), the intended chain is:

```
DEPT_MANAGER  →  TEAM_LEADER  →  EMPLOYEE
```

| Role | Meaning |
|------|---------|
| **DEPT_MANAGER** | Responsible for one **department**. Configured as the department’s **admin** (`departments.admin_id` → user id). May manage **teams** (CRUD) inside that department and manage **team leaders** and **employees** in that department via the user APIs. |
| **TEAM_LEADER** | Leads one **team** (`teams.team_leader_id` → user id). Typically has a **department** so they appear in pickers before a team exists; once a team is created and they are assigned, they manage **employees on that team**. |
| **EMPLOYEE** | Member of a **team** (`users.team_id`). Must have a team for valid profile rules. Punches and personal history are scoped to their account. |

**SUPER_ADMIN** and **ADMIN** sit **above** this ladder for **platform and global admin** tasks. They **own department CRUD** (`POST/PUT/DELETE /api/departments`) and can work across all departments. **ADMIN** cannot target **SUPER_ADMIN** users in management rules—see `UserAdminService`.

### 8.2 Data links (who is “attached” where)

| Concept | Storage / API field | Typical role |
|--------|---------------------|--------------|
| Department manager for a department | `Department.adminId` in API (`admin_id` in DB) | User with role **DEPT_MANAGER** (same user is also linked via `users.department_id`) |
| Team leader for a team | `Team.teamLeaderId` | User with role **TEAM_LEADER** |
| Employee membership | `User.teamId` (and department derived from team when set) | **EMPLOYEE** |

**Workflow in order (recommended):**

1. **Super Admin / Admin** creates **departments** and sets **adminId** to a **DEPT_MANAGER** user (create that user first under *Staff & roles*, or assign when editing the department).
2. Same tier (or **DEPT_MANAGER** for their department only) creates **teams** via team CRUD, choosing a **TEAM_LEADER** already scoped to that department.
3. **Employees** are created with a **team**; **team leaders** and **department managers** manage them according to service-level rules.

### 8.3 Who can CRUD what (summary)

| Resource | SUPER_ADMIN | ADMIN | DEPT_MANAGER | Others |
|----------|-------------|-------|--------------|--------|
| **Departments** | Full | Full | List / read (writes per policy) | As per `@PreAuthorize` |
| **Teams** | Full (any dept) | Full (any dept) | Full **within own `department_id`** | — |
| **Users** | Broad (incl. other admins, subject to rules) | All except managing **SUPER_ADMIN** | **EMPLOYEE** and **TEAM_LEADER** **in own department only** | **TEAM_LEADER**: employees **on own team** only |

Exact rules live in **`DepartmentController`**, **`TeamController`**, and **`UserAdminService`** (method security + `assertCanManageUser` / `assertDepartmentAccess`).

### 8.4 UI mapping (frontend)

| Page | Audience | Purpose |
|------|----------|---------|
| **Departments** | SUPER_ADMIN, ADMIN | Department CRUD + optional **DEPT_MANAGER** assignment (`adminId`). |
| **Teams** | SUPER_ADMIN, ADMIN, DEPT_MANAGER | Team CRUD; **DEPT_MANAGER** sees only their department; each team requires a **TEAM_LEADER** from that department. |
| **Staff & roles** | SUPER_ADMIN, ADMIN | Create/edit users with roles **ADMIN**, **DEPT_MANAGER**, **TEAM_LEADER**, **EMPLOYEE**, etc., with department/team fields matching backend validation. |
| **Employees** | SUPER_ADMIN, ADMIN, DEPT_MANAGER, TEAM_LEADER | Focused flows for **EMPLOYEE** accounts (team assignment, etc.). |

This architecture is intentionally **modular**: you can document each layer in your PFE report (presentation, application, persistence, integration) using the sections above.
