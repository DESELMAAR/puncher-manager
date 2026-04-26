# Accessing your Postgres database (Docker)

This project uses **PostgreSQL**. When it runs in **Docker**, you can connect in a few ways:

## 1) Find your running Postgres container

In a terminal:

```bash
docker ps
```

Look for an image like `postgres` and note the container **NAME** (example: `puncher-postgres`).

If you don’t see it, list stopped containers too:

```bash
docker ps -a
```

## 2) Check which port is exposed to your machine

```bash
docker port <container_name>
```

Example output:

```
5432/tcp -> 0.0.0.0:5432
```

This means you connect to **localhost:5432** from Windows.

## 3) Connect using `psql` (recommended)

### Option A — connect from your Windows machine (host)

Install PostgreSQL client tools (only `psql` is needed), then run:

```bash
psql "postgresql://<user>:<password>@localhost:<port>/<db_name>"
```

Example (matches the default in `backend/src/main/resources/application.yml`):

```bash
psql "postgresql://postgres:postgres@localhost:5432/puncher_manager"
```

### Option B — connect *inside* the container (no local install)

```bash
docker exec -it <container_name> psql -U <user> -d <db_name>
```

Example:

```bash
docker exec -it puncher-postgres psql -U postgres -d puncher_manager
```

## 4) Basic `psql` commands you’ll use

Inside `psql`:

```sql
\l           -- list databases
\c puncher_manager   -- connect to database
\dt          -- list tables
\d departments -- describe a table
SELECT NOW();
```

Quit:

```sql
\q
```

## 5) Connect using pgAdmin (GUI)

Create a new server in pgAdmin:

- **Host name/address**: `localhost`
- **Port**: the mapped port you saw (often `5432`)
- **Maintenance database**: `postgres` (or your DB name)
- **Username**: `postgres` (or your configured user)
- **Password**: your configured password

## 6) Match it with Spring Boot (`application.yml`)

Backend config lives in:

- `backend/src/main/resources/application.yml`

The JDBC URL format is:

```
jdbc:postgresql://<host>:<port>/<db_name>
```

Example:

```
jdbc:postgresql://localhost:5432/puncher_manager
```

If you use Docker Compose and your Spring Boot backend also runs **inside Docker**, the host is usually the **service name** (not `localhost`). Example:

```
jdbc:postgresql://postgres:5432/puncher_manager
```

## 7) (Optional) Create the database + schema manually

The schema file is:

- `database/schema.sql`

If your container is fresh and you need to create the DB:

```sql
CREATE DATABASE puncher_manager;
```

Then load the schema:

```bash
psql "postgresql://postgres:postgres@localhost:5432/puncher_manager" -f database/schema.sql
```

