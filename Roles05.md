# Roles reference — Puncher Manager (`Roles05`)

This document explains **each role name** stored in the database (`users.role`) and enforced by Spring Security (`ROLE_*` authorities). Values are **fixed enumeration constants** — use them **exactly** as shown (uppercase, underscores).

---

## How roles appear in the system

| Layer | Format | Example |
|-------|--------|---------|
| **Java enum** (`UserRole`) | `ENUM_NAME` | `TEAM_LEADER` |
| **PostgreSQL column** (`users.role`) | Same string | `TEAM_LEADER` |
| **JWT claim** (`role`) | Same string | `TEAM_LEADER` |
| **Spring Security authority** | `ROLE_` + enum name | `ROLE_TEAM_LEADER` |

APIs and Swagger use the **enum-style** names; Spring’s `@PreAuthorize("hasRole('EMPLOYEE')")` expects the **`ROLE_` prefix internally** — that is handled for you when the JWT is built.

---

## Role list (conceptual hierarchy)

Roughly: **SUPER_ADMIN** → **ADMIN** → **DEPT_MANAGER** → **TEAM_LEADER** → **EMPLOYEE**.

Not every role outranks another globally; **scope** matters (org-wide vs department vs single team).

---

### 1. `SUPER_ADMIN`

| Item | Detail |
|------|--------|
| **Meaning** | Highest privilege: full visibility and management across **all** departments, teams, users, and system data within this application. |
| **Typical use** | Bootstrap account, IT owner of the Puncher deployment. |
| **Organization** | Usually **no** department or team assignment (`department_id` / `team_id` null). |
| **Examples in app** | User management (`/api/users`), departments (`/api/departments`), teams (`/api/teams`), attendance exports for any scope the services allow. |

---

### 2. `ADMIN`

| Item | Detail |
|------|--------|
| **Meaning** | Organization-level administrator (sometimes called “department manager” in product language, but **distinct** from `DEPT_MANAGER` in code). Manages structure and policies **across departments**, without necessarily belonging to one department’s day-to-day roster. |
| **Typical use** | HR or operations head who creates departments and assigns department admins. |
| **Vs `SUPER_ADMIN`** | Cannot manage another `SUPER_ADMIN` user (enforced in user admin logic). Broad access similar to super admin for day-to-day operations. |

---

### 3. `DEPT_MANAGER`

| Item | Detail |
|------|--------|
| **Meaning** | **Department** scope: manages **one department** — its teams (via API), roster in that department, and department attendance summaries as implemented. |
| **Typical use** | Head of Engineering, Operations lead, etc. |
| **Organization** | Has a **`department_id`**; often referenced as **`admin`** on the `departments` row. |
| **Vs team leader** | Owns the **department**; may create/update **teams** inside that department. Does **not** punch as an hourly employee unless you also model them as `EMPLOYEE` (this app uses **one role per user**). |

---

### 4. `TEAM_LEADER`

| Item | Detail |
|------|--------|
| **Meaning** | **Team** scope: leads **one team** — add/remove **employees** on that team, view **team punch logs** and attendance, **send notifications** to team members. |
| **Typical use** | Squad lead, shift supervisor. |
| **Organization** | Has **`team_id`** (the team they lead) and shares the department of that team. |
| **Punching** | In this application, punching (`/api/punch`) is restricted to **`EMPLOYEE`**. Team leaders use leader features, not the employee punch pad, unless you change the rules. |

---

### 5. `EMPLOYEE`

| Item | Detail |
|------|--------|
| **Meaning** | Standard worker: **daily punches** (start, breaks, lunch, end), **own punch history**, **receive notifications**. |
| **Typical use** | Anyone who must record attendance against planning and shifts. |
| **Organization** | Belongs to **exactly one team** (`team_id`) and thus one department (aligned with that team). |

---

## Quick comparison table

| Role | Org breadth | Punch | Manage teams/depts | Notify team |
|------|-------------|-------|----------------------|-------------|
| `SUPER_ADMIN` | Global | No (by default rules) | Yes | N/A |
| `ADMIN` | Broad | No | Yes | N/A |
| `DEPT_MANAGER` | Department | No | Teams in dept | No |
| `TEAM_LEADER` | Team | No | Membership of own team | Yes |
| `EMPLOYEE` | Self + team membership | Yes | No | Receive only |

*(Exact endpoints depend on `@PreAuthorize` and service checks in the codebase; this table reflects intended design.)*

---

## Status vs role

Do not confuse **`role`** with **`status`** (`ACTIVE`, `INACTIVE`, `ON_LEAVE`). **Role** answers *what permissions the account has*; **status** answers *whether the account should participate* (e.g. absence job uses active employees).

---

## Related files

| File | Content |
|------|---------|
| `architectureExplain03.md` | Architecture and security overview |
| `endpointTest01.md` | Which endpoints expect which roles |
| `SwaggerDocumenter.md` | Trying endpoints with JWT in Swagger UI |

---

*End of Roles05.*
