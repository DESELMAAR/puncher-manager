# Endpoint testing guide (Postman) — Puncher Manager

This document lists **every REST endpoint** exposed by the backend, how to call it from **Postman**, what **authentication** is required, and what to expect in responses. Base URL examples use `http://localhost:8080`; replace it if your server runs elsewhere.

---

## 1. Postman setup (once)

### Environment variables

Create a Postman **Environment** (for example `Puncher Local`) with:

| Variable | Initial value | Usage |
|----------|-----------------|--------|
| `baseUrl` | `http://localhost:8080` | All requests prefix |
| `token` | *(empty)* | Filled after login |

### Authorization header for protected routes

After login, set the collection or folder authorization:

- Type: **Bearer Token**
- Token: `{{token}}`

Or manually add header:

- Key: `Authorization`
- Value: `Bearer {{token}}`

### Getting the token from login

1. Send **POST** `{{baseUrl}}/api/auth/login` (see below).
2. From the response JSON, copy the `token` value.
3. Paste into environment variable `token`, or use a **Test** script on the login request:

```javascript
const json = pm.response.json();
if (json.token) {
  pm.environment.set("token", json.token);
}
```

---

## 2. Public endpoints (no JWT)

### 2.1 Login

| Field | Value |
|--------|--------|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/api/auth/login` |
| **Auth** | None |
| **Body** | `raw` → `JSON` |

**Example body:**

```json
{
  "email": "employee@puncher.com",
  "password": "demo123"
}
```

**Explanation:** Validates email/password against the database (BCrypt). Returns a JWT and profile fields (`role`, `departmentId`, `teamId`, etc.). Use seeded accounts from the README (e.g. superadmin@puncher.com / admin123).

**Typical success (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "userId": "...",
  "name": "Jamie Employee",
  "email": "employee@puncher.com",
  "role": "EMPLOYEE",
  "employeeId": "EMP001",
  "departmentId": "...",
  "teamId": "..."
}
```

**Typical error (401):** `message` describes invalid credentials.

---

### 2.2 Mock planning API

| Field | Value |
|--------|--------|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/planning/mock/{{employeeId}}/{{date}}` |
| **Auth** | None (open in dev; restrict in production) |

**Path parameters:**

- `employeeId`: e.g. `EMP001`
- `date`: ISO date, e.g. `2026-03-20`

**Explanation:** Simulates an external planning service. Weekdays return fixed `09:00`–`17:00`; weekends return `workingDay: false`.

**Example:** `GET {{baseUrl}}/api/planning/mock/EMP001/2026-03-20`

**Weekday response (200):**

```json
{
  "employeeId": "EMP001",
  "date": "2026-03-20",
  "expectedStartTime": "09:00:00",
  "expectedEndTime": "17:00:00",
  "workingDay": true
}
```

---

## 3. Protected endpoints (JWT required)

Use **Bearer {{token}}** unless noted.

---

### 3.1 Punches (EMPLOYEE)

| Field | Value |
|--------|--------|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/api/punch` |
| **Auth** | Bearer |
| **Role** | `EMPLOYEE` |

**Body (JSON):**

```json
{
  "type": "WORK_START",
  "timestamp": "2026-04-18T08:58:00.000Z"
}
```

- `type`: one of `WORK_START`, `BREAK1_START`, `BREAK1_END`, `LUNCH_START`, `LUNCH_END`, `BREAK2_START`, `BREAK2_END`, `LOGOUT`.
- `timestamp`: optional (ISO-8601); if omitted, server uses current time.

**Explanation:** Enforces **strict order** for the current calendar day. Wrong order returns **400** with a clear `message` (e.g. next expected punch).

---

| Field | Value |
|--------|--------|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/punch/my-history` |
| **Auth** | Bearer |
| **Role** | `EMPLOYEE` |
| **Query** | `from` = `2026-04-01`, `to` = `2026-04-30` (ISO dates) |

**Explanation:** Returns your punch list in the date range.

---

### 3.2 Attendance (team view + CSV)

| Field | Value |
|--------|--------|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/attendance/team/{{teamId}}` |
| **Auth** | Bearer |
| **Role** | `TEAM_LEADER`, `DEPT_MANAGER`, `SUPER_ADMIN`, or `ADMIN` |
| **Query** | `date` = `2026-04-18` |

**Explanation:** One day of attendance + punch summaries for each **employee** in that team. `teamId` must be in scope for your role (e.g. leader must own the team).

---

| Field | Value |
|--------|--------|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/attendance/team/{{teamId}}/export` |
| **Auth** | Bearer |
| **Role** | Same as above |
| **Query** | `date` = `2026-04-18` |

**Explanation:** Returns **CSV** file (`text/csv`). In Postman, use **Send and Download** to save the file.

---

### 3.3 Notifications

| Field | Value |
|--------|--------|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/api/notification/send` |
| **Auth** | Bearer |
| **Role** | `TEAM_LEADER` |

**Body:**

```json
{
  "teamId": "<uuid-of-team>",
  "message": "Team meeting at 15:00"
}
```

**Explanation:** Sends one notification row per employee on the team; pushes SSE events to connected clients.

---

| Field | Value |
|--------|--------|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/notification/my` |
| **Auth** | Bearer |
| **Role** | Any authenticated user |

**Explanation:** Lists notifications where you are the **receiver**.

---

| Field | Value |
|--------|--------|
| **Method** | `PATCH` |
| **URL** | `{{baseUrl}}/api/notification/{{notificationId}}/read` |
| **Auth** | Bearer |

**Explanation:** Marks a notification as read (must be yours).

---

| Field | Value |
|--------|--------|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/notification/stream` |
| **Auth** | Special (see below) |

**Explanation:** **Server-Sent Events** stream. Standard browsers do not send custom headers to `EventSource`, so either:

- Use Postman’s request type that supports streaming (limited), **or**
- Call with query parameter:  
  `GET {{baseUrl}}/api/notification/stream?access_token={{token}}`  
  The backend accepts JWT from this query string **only** for this path (development convenience).

---

### 3.4 Departments

| Field | Value |
|--------|--------|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/departments` |
| **Auth** | Bearer |
| **Role** | Any authenticated role (as per app policy) |

---

| Field | Value |
|--------|--------|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/api/departments` |
| **Auth** | Bearer |
| **Role** | `SUPER_ADMIN`, `ADMIN` |

**Body:**

```json
{
  "name": "Operations",
  "description": "Ops department",
  "adminId": "<uuid-of-dept-manager-user>"
}
```

`adminId` optional; if set, user must have role `DEPT_MANAGER`.

---

| Field | Value |
|--------|--------|
| **Method** | `PUT` |
| **URL** | `{{baseUrl}}/api/departments/{{departmentId}}` |
| **Auth** | Bearer |
| **Role** | `SUPER_ADMIN`, `ADMIN` |

**Body:** Same shape as POST.

---

| Field | Value |
|--------|--------|
| **Method** | `DELETE` |
| **URL** | `{{baseUrl}}/api/departments/{{departmentId}}` |
| **Auth** | Bearer |
| **Role** | `SUPER_ADMIN`, `ADMIN` |

---

### 3.5 Teams

| Field | Value |
|--------|--------|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/teams/department/{{departmentId}}` |
| **Auth** | Bearer |
| **Role** | `SUPER_ADMIN`, `ADMIN`, `DEPT_MANAGER`, `TEAM_LEADER` |

**Explanation:** Lists teams in a department you are allowed to see.

---

| Field | Value |
|--------|--------|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/api/teams` |
| **Auth** | Bearer |
| **Role** | `SUPER_ADMIN`, `ADMIN`, `DEPT_MANAGER` |

**Body:**

```json
{
  "name": "Beta",
  "departmentId": "<uuid>",
  "teamLeaderId": "<uuid-user-with-role-TEAM_LEADER>"
}
```

---

| Field | Value |
|--------|--------|
| **Method** | `PUT` |
| **URL** | `{{baseUrl}}/api/teams/{{teamId}}` |
| **Auth** | Bearer |
| **Role** | Same as POST |

---

| Field | Value |
|--------|--------|
| **Method** | `DELETE` |
| **URL** | `{{baseUrl}}/api/teams/{{teamId}}` |
| **Auth** | Bearer |

---

### 3.6 Team membership (TEAM_LEADER)

| Field | Value |
|--------|--------|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/api/teams/{{teamId}}/members/{{userId}}` |
| **Auth** | Bearer |
| **Role** | `TEAM_LEADER` (must be leader of `teamId`) |

**Explanation:** Adds an **EMPLOYEE** to the team (same department as team).

---

| Field | Value |
|--------|--------|
| **Method** | `DELETE` |
| **URL** | `{{baseUrl}}/api/teams/{{teamId}}/members/{{userId}}` |
| **Auth** | Bearer |
| **Role** | `TEAM_LEADER` |

---

### 3.7 Users (admin)

| Field | Value |
|--------|--------|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/users` |
| **Auth** | Bearer |
| **Role** | `SUPER_ADMIN`, `ADMIN`, `DEPT_MANAGER` |

---

| Field | Value |
|--------|--------|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/api/users` |
| **Auth** | Bearer |

**Body (example):**

```json
{
  "name": "New Employee",
  "email": "newemp@company.com",
  "password": "changeme123",
  "employeeId": "EMP099",
  "phoneNumber": "+1234567890",
  "hiringDate": "2026-01-01",
  "status": "ACTIVE",
  "role": "EMPLOYEE",
  "departmentId": null,
  "teamId": "<uuid-team>"
}
```

Rules depend on caller role (see application services). **EMPLOYEE** requires `teamId`.

---

| Field | Value |
|--------|--------|
| **Method** | `PUT` |
| **URL** | `{{baseUrl}}/api/users/{{userId}}` |
| **Auth** | Bearer |

**Body:** Same fields as POST; `password` optional on update.

---

| Field | Value |
|--------|--------|
| **Method** | `DELETE` |
| **URL** | `{{baseUrl}}/api/users/{{userId}}` |
| **Auth** | Bearer |

---

## 4. Typical HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | Success (GET, PATCH, DELETE with body optional) |
| 400 | Validation or business rule (e.g. wrong punch order) |
| 401 | Missing/invalid JWT or bad login |
| 403 | Authenticated but role/scope denied |
| 404 | Resource not found |
| 500 | Unexpected server error (check backend logs) |

Error bodies usually include `message` and `timestamp` (see global exception handler).

---

## 5. Suggested Postman collection order

1. **Login** (employee) → save `token`.
2. **GET** `my-history` for today (empty or partial punches).
3. **POST** punch sequence until `LOGOUT` (if testing full day).
4. **Login** as team lead → **GET** attendance for team + **export**.
5. **POST** notification send → **GET** my notifications as employee.
6. **Login** as super admin → departments / teams / users CRUD smoke tests.

This covers **every** controller route in the current codebase. If you add endpoints later, append them to this file in the same format.
