# Run guide — Backend, Frontend, and PostgreSQL (including Docker)

This guide explains how to run **PostgreSQL**, the **Spring Boot** API, and the **Next.js** UI: first **without Docker** (good for daily development), then **with Docker Compose** (good for demos and consistent environments).

---

## Part A — Concepts (what runs where)

| Component | Default port | Purpose |
|-----------|----------------|---------|
| PostgreSQL | 5432 | Stores users, punches, attendance, notifications, etc. |
| Spring Boot API | 8080 | REST API + JWT + scheduled jobs |
| Next.js | 3000 | Browser UI; calls API using `NEXT_PUBLIC_API_URL` |

The **browser** talks only to **Next.js** (pages) and to the **API** (HTTP). The API talks to **PostgreSQL**. Next.js does not connect to Postgres directly.

---

## Part B — Run locally (no Docker)

### B.1 PostgreSQL

1. Install PostgreSQL for your OS (installer or package manager).
2. Create a database:

```sql
CREATE DATABASE puncher_manager;
```

3. Note **host** (usually `localhost`), **port** (`5432`), **user**, **password**.

The Spring app uses Hibernate `ddl-auto: update`, so tables are created automatically on first startup (you can still apply `database/schema.sql` manually if you prefer explicit DDL).

---

### B.2 Backend

From the project root:

```powershell
cd backend
```

Set environment variables if your Postgres credentials differ from defaults (`postgres` / `postgres`):

```powershell
$env:DB_PASSWORD = "your-password"
$env:JWT_SECRET = "use-a-long-random-secret-at-least-32-characters-long"
```

Start:

```powershell
mvn spring-boot:run
```

Or package then run:

```powershell
mvn -DskipTests package
java -jar target/puncher-manager-0.0.1-SNAPSHOT.jar
```

**Check:** open `http://localhost:8080` — you may get 401/404 without auth; that confirms the server is up.

---

### B.3 Frontend

```powershell
cd frontend
copy .env.local.example .env.local
```

Edit `.env.local` if the API is not on port 8080:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Install and run:

```powershell
npm install
npm run dev
```

**Check:** `http://localhost:3000` → login page.

---

## Part C — Run with Docker

Docker runs each service in a **container**. `docker-compose` reads `docker-compose.yml` and starts **postgres**, **backend**, and **frontend** together with the right **environment variables** and **startup order**.

### C.1 Prerequisites

- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) or Docker Engine + Compose on Linux.
- From the project root, ensure these files exist (they are provided in the repo):
  - `docker-compose.yml`
  - `backend/Dockerfile`
  - `frontend/Dockerfile`

---

### C.2 What the Compose file does (explanation)

1. **postgres**  
   - Official `postgres` image.  
   - Creates database `puncher_manager` and user/password from environment.  
   - Persists data in a **named volume** so data survives container restarts.

2. **backend**  
   - Built from `backend/Dockerfile` (Maven builds the JAR, then a small JRE image runs it).  
   - `DB_HOST=postgres` so the API resolves the database **by service name** on the Docker network (not `localhost`).  
   - Waits for Postgres to be reachable (depends_on + optional healthcheck).

3. **frontend**  
   - Built from `frontend/Dockerfile` (`npm run build` then `npm start`).  
   - **`NEXT_PUBLIC_API_URL`** must point to where **the browser** will call the API.  
   - If you publish ports `3000` and `8080` on the **same machine**, use `http://localhost:8080` in the **build argument** so the client bundle embeds the correct API URL.

---

### C.3 Build and start everything

From the repository root (`Puncher 01`):

```powershell
docker compose build --no-cache
docker compose up -d
```

View logs:

```powershell
docker compose logs -f
```

Stop:

```powershell
docker compose down
```

Stop and delete database volume (⚠ wipes DB):

```powershell
docker compose down -v
```

---

### C.4 URLs after Compose

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8080 |
| Postgres | localhost:5432 *(from host machine; use a SQL client if needed)* |

Login with seeded users after the backend has started at least once (see main `README.md`).

---

### C.5 Troubleshooting Docker

| Problem | What to check |
|---------|----------------|
| Backend exits immediately | `docker compose logs backend` — often DB connection (`DB_HOST`, password). |
| Frontend calls wrong API | Rebuild frontend with correct `NEXT_PUBLIC_API_URL` build-arg; it is baked at **build** time. |
| Port already in use | Stop local Postgres / other services using 5432, 8080, or 3000, or change published ports in `docker-compose.yml`. |
| Tables empty / no seed | Ensure backend container runs long enough for `DataSeeder`; check logs for “Seeding…”. |

---

### C.6 Changing API URL for production

For a real deployment you might put **Nginx** or a **gateway** in front and use a single public host, for example:

- UI: `https://app.example.com`
- API: `https://api.example.com`

Then build the frontend with:

`NEXT_PUBLIC_API_URL=https://api.example.com`

---

## Part D — Environment variable reference

| Variable | Used by | Meaning |
|----------|---------|---------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Backend | JDBC connection |
| `JWT_SECRET`, `JWT_EXPIRATION_MS` | Backend | JWT signing and TTL |
| `CORS_ORIGINS` | Backend | Allowed browser origins (comma-separated) |
| `SERVER_PORT` | Backend | Default 8080 |
| `NEXT_PUBLIC_API_URL` | Frontend | Base URL for Axios (must match how the browser reaches the API) |

---

## Quick reference — commands

| Goal | Command |
|------|---------|
| Local API | `cd backend` → `mvn spring-boot:run` |
| Local UI | `cd frontend` → `npm run dev` |
| Docker all | `docker compose up -d --build` |
| Docker logs | `docker compose logs -f` |

For endpoint-level testing with Postman, see **`endpointTest01.md`**.
