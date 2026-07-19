# How to Launch Locally — Puncher Manager

Guide to run the **backend** (Spring Boot) and **frontend** (Next.js) on your machine.

---

## Prerequisites

Install and verify:

| Tool | Version | Check |
|------|---------|--------|
| **Java** | 17+ | `java -version` |
| **Maven** | 3.9+ | `mvn -version` |
| **Node.js** | 18+ | `node -v` |
| **npm** | 9+ | `npm -v` |
| **PostgreSQL** | 14+ | `psql --version` |

Optional: **Docker Desktop** (if you prefer Postgres via Docker).

---

## 1. Start PostgreSQL

### Option A — Local PostgreSQL

1. Create database (psql or pgAdmin):

```sql
CREATE DATABASE puncher_db;
```

2. Default credentials expected by the backend (`application.yml`):

| Setting | Default |
|---------|---------|
| Host | `localhost` |
| Port | `5432` |
| Database | `puncher_db` |
| User | `postgres` |
| Password | `1234` |

If your password is different, set `DB_PASSWORD` when starting the backend (see below).

### Option B — Postgres with Docker only

From the project root:

```powershell
docker compose up -d postgres
```

This starts Postgres with:

- DB: `puncher_db`
- User: `postgres`
- Password: `postgres`
- Port: `5432`

Then set when running the backend:

```powershell
$env:DB_PASSWORD = "postgres"
```

---

## 2. Launch the Backend

Open a terminal:

```powershell
cd "C:\Users\deselmaar\Desktop\Puncher 01\backend"
```

### Optional environment variables (PowerShell)

```powershell
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_NAME = "puncher_db"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "1234"          # change if needed
$env:JWT_SECRET = "local-dev-secret-change-me-min-32-characters"
$env:CORS_ORIGINS = "http://localhost:3000"
$env:SERVER_PORT = "8080"
```

### Run

```powershell
mvn spring-boot:run
```

Wait until you see something like: `Started PuncherManagerApplication`.

| Service | URL |
|---------|-----|
| API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| OpenAPI JSON | http://localhost:8080/v3/api-docs |

Tables are created automatically (`ddl-auto: update`). On first start, demo users are seeded.

---

## 3. Launch the Frontend

Open a **second** terminal:

```powershell
cd "C:\Users\deselmaar\Desktop\Puncher 01\frontend"
```

### Configure API URL

```powershell
copy .env.local.example .env.local
```

Content of `.env.local` (default):

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Install & run

```powershell
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |

---

## 4. Login (demo accounts)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `superadmin@puncher.com` | `admin123` |
| Dept Manager | `deptmgr@puncher.com` | `demo123` |
| Team Leader | `teamlead@puncher.com` | `demo123` |
| Employee | `employee@puncher.com` | `demo123` |

---

## 5. Quick checklist

1. PostgreSQL running (`puncher_db`)
2. Backend: `cd backend` → `mvn spring-boot:run` → http://localhost:8080
3. Frontend: `cd frontend` → `npm run dev` → http://localhost:3000
4. Open the app and log in

---

## 6. Optional: everything with Docker Compose

From the project root:

```powershell
docker compose up -d --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend (mapped) | http://localhost:8081 |
| Postgres | `localhost:5432` |

Note: in Docker, the frontend calls the API on port **8081**.

Stop:

```powershell
docker compose down
```

---

## 7. Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend fails to connect to DB | Check Postgres is running; password matches `DB_PASSWORD` or default `1234` |
| `mvn` not found | Install Maven or use a full path; run from `backend/` folder |
| Frontend can’t reach API | Check `.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:8080` and that backend is up |
| Port 8080 already used | `$env:SERVER_PORT = "8081"` and update frontend `.env.local` |
| Port 3000 already used | Next.js will offer another port (e.g. 3001) |
| CORS error | Set `$env:CORS_ORIGINS = "http://localhost:3000"` |

---

## 8. Useful commands

**Backend only**

```powershell
cd backend
mvn spring-boot:run
```

**Frontend only**

```powershell
cd frontend
npm run dev
```

**Test login (PowerShell)**

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"superadmin@puncher.com","password":"admin123"}'
```
