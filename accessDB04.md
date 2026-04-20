# Access PostgreSQL in Docker — Puncher Manager (`accessDB04`)

This guide explains **how to connect to the Postgres database** when it runs inside Docker (as defined in **`docker-compose.yml`** in this project). Use it for debugging, inspecting tables, or running SQL manually.

---

## 1. Connection settings (from this repo’s Compose file)

These values match the **`postgres`** service in `docker-compose.yml`:

| Setting | Value |
|---------|--------|
| **Database name** | `puncher_manager` |
| **User** | `postgres` |
| **Password** | `postgres` |
| **Port (on your PC)** | `5432` (published to the host) |
| **Host from your PC** | `localhost` or `127.0.0.1` |
| **Host from another Docker container on the same Compose network** | Service name: `postgres` |

If you changed `POSTGRES_*` or ports in Compose, use **your** values instead.

---

## 2. Preconditions

1. **Docker** is installed and running.
2. Containers are **up**:

```powershell
cd "<path-to-project-root>"
docker compose up -d
```

3. Confirm the Postgres container is running:

```powershell
docker compose ps
```

You should see the `postgres` service **running** (and healthy if healthcheck passes).

---

## 3. Option A — `psql` **inside** the Postgres container (recommended for quick checks)

Docker runs a shell **inside** the container; you connect as `postgres` locally on port 5432 **inside** that container (no password prompt if trust is enabled for local socket—usually `psql -U postgres` works).

### 3.1 Open an interactive SQL session

From the **same folder** where `docker-compose.yml` lives:

```powershell
docker compose exec postgres psql -U postgres -d puncher_manager
```

**Explanation:**

- `docker compose exec` runs a command in a **running** container.
- `postgres` is the **service name** from `docker-compose.yml`.
- `psql` is the PostgreSQL client inside the official Postgres image.
- `-U postgres` sets the DB user.
- `-d puncher_manager` selects the database.

You should see a prompt like:

```text
puncher_manager=#
```

Try:

```sql
\dt
SELECT * FROM users LIMIT 5;
\q
```

`\dt` lists tables; `\q` quits.

### 3.2 Run a single command without staying in `psql`

```powershell
docker compose exec postgres psql -U postgres -d puncher_manager -c "SELECT COUNT(*) FROM users;"
```

---

## 4. Option B — Connect from **your machine** (host) on port `5432`

Because Compose maps **`5432:5432`**, Postgres listens on **`localhost:5432`** on Windows/macOS/Linux.

### 4.1 Using `psql` on the host

If **psql** is installed locally (PostgreSQL client tools):

```powershell
psql -h localhost -p 5432 -U postgres -d puncher_manager
```

Password when prompted: **`postgres`**.

Connection URI form:

```text
postgresql://postgres:postgres@localhost:5432/puncher_manager
```

### 4.2 GUI tools (DBeaver, pgAdmin, DataGrip, VS Code extensions)

Use a **PostgreSQL** connection with:

| Field | Value |
|-------|--------|
| Host | `localhost` |
| Port | `5432` |
| Database | `puncher_manager` |
| Username | `postgres` |
| Password | `postgres` |

**Explanation:** Traffic goes from your GUI → Docker’s published port → Postgres container.

---

## 5. Option C — Another container on the **same Compose network**

If you add a tool container to the **same** `docker-compose.yml` network, use:

- **Host:** `postgres` (the Compose **service name**, not `localhost`).
- **Port:** `5432`.
- **User / database / password:** same as above.

Example connection string inside that network:

```text
postgresql://postgres:postgres@postgres:5432/puncher_manager
```

**Explanation:** On the internal Docker network, containers resolve each other by **service name**. `localhost` inside a container refers to **that container**, not the Postgres container.

---

## 6. Finding the container name (optional)

Compose creates container names like `foldername-postgres-1`. To list containers:

```powershell
docker compose ps
```

Raw Docker:

```powershell
docker ps --filter "ancestor=postgres:16-alpine"
```

You can still use **`docker compose exec postgres ...`** without memorizing the full container name **if** you run commands from the directory that contains **`docker-compose.yml`**.

Equivalent using container name:

```powershell
docker exec -it <container_name_or_id> psql -U postgres -d puncher_manager
```

---

## 7. Troubleshooting

| Problem | What to try |
|---------|--------------|
| `connection refused` on localhost:5432 | Run `docker compose ps`; ensure `postgres` is **Up**. Check nothing else on host uses port 5432 (`netstat` / Resource Monitor). |
| Wrong password | Match `POSTGRES_PASSWORD` in `docker-compose.yml` (default **`postgres`**). |
| Forgot database name | Default is **`puncher_manager`** (`POSTGRES_DB`). |
| `psql` not found on Windows host | Install PostgreSQL client tools, or use **Option A** (`docker compose exec postgres psql ...`) — no local `psql` needed. |
| Tables empty before first API run | Hibernate **`ddl-auto: update`** creates tables when the Spring app starts; seed users run when the backend starts (**DataSeeder**). |

---

## 8. Useful `psql` commands

| Command | Meaning |
|---------|---------|
| `\l` | List databases |
| `\c puncher_manager` | Connect to database |
| `\dt` | List tables |
| `\d users` | Describe table `users` |
| `\q` | Quit |

---

## Related docs

| File | Topic |
|------|--------|
| `runEplanation02.md` | Starting the stack with Docker Compose |
| `architectureExplain03.md` | How the API uses PostgreSQL |
| `database/schema.sql` | Reference DDL (optional if using JPA auto DDL) |

---

*End of accessDB04.*
