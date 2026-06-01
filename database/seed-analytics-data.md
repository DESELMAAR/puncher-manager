# Seed fake analytics data (local Postgres + AWS RDS)

The backend `DataSeeder` can populate your database with demo data for **Power BI**:

| What gets created | Details |
|-------------------|---------|
| **Analytics org** | 3 departments, 6 teams, 24 employees (`ANALYTICS-*` IDs) |
| **Core / study data** | Engineering, Alpha Squad, Nebula Nine, etc. (if missing) |
| **Punches** | ~2 months of weekdays per employee |
| **attendance_records** | ON_TIME / LATE derived after each LOGOUT |
| **Schedules** | Confirmed weekly Mon–Fri 09:00–17:00 |

All analytics demo passwords: **`demo123`**

---

## Safety

Seeding is **disabled by default**. It runs only when:

```text
PUNCHER_SEED_ENABLED=true
```

Properties (also in `application.yml`):

| Env variable | Property | Default |
|--------------|----------|---------|
| `PUNCHER_SEED_ENABLED` | `puncher.seed.enabled` | `false` |
| `PUNCHER_SEED_GENERATEATTENDANCERECORDS` | `puncher.seed.generateAttendanceRecords` | `true` |
| `PUNCHER_SEED_ANALYTICS` | `puncher.seed.analytics` | `true` |

Analytics org is **idempotent**: if `ANALYTICS-DM-HR` already exists, departments/teams are not recreated (punch seeding still runs for missing days).

---

## Analytics org created

| Department | Teams | Late grace |
|------------|-------|------------|
| **Human Resources** | Talent Forge, People Pulse | 10 min |
| **Operations** | Logistics Lane, Field Response | 15 min |
| **Sales & Marketing** | Growth Grid, Brand Beacon | 5 min |

Each team: 1 team leader + 4 employees (on-time / grace / late / very late naming).

Filter in SQL or Power BI:

```sql
SELECT * FROM users WHERE employee_id LIKE 'ANALYTICS-%';
SELECT * FROM departments WHERE name IN ('Human Resources', 'Operations', 'Sales & Marketing');
```

Sample login: `nina.ontime.hr1@analytics.demo` / `demo123`

---

## A) Seed local Postgres (Docker)

### 1. Start Postgres

From repo root:

```powershell
docker compose up -d postgres
```

### 2. Run backend against local DB + enable seeding

```powershell
cd backend
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:DB_NAME="puncher_db"
$env:DB_USER="postgres"
$env:DB_PASSWORD="postgres"
$env:PUNCHER_SEED_ENABLED="true"
.\mvnw spring-boot:run
```

Wait until you see logs like:

- `Seeding analytics org (departments, teams, employees) for Power BI`
- `Analytics org seeded: 3 departments, 6 teams, 24 employees`
- `Seeded N future punch-days`

Stop with `Ctrl+C`.

---

## B) Seed AWS RDS (via SSH tunnel)

RDS is private. Use the same tunnel as Power BI.

### 1. Start SSH tunnel (keep window open)

```powershell
ssh -i "C:\Users\deselmaar\Downloads\puncher-powerbi-gateway2-keypair.pem" `
  -L 5433:puncher-manager-postgres.cje2qymy83zz.eu-west-1.rds.amazonaws.com:5432 `
  ec2-user@3.249.43.245
```

Verify:

```powershell
Test-NetConnection localhost -Port 5433
```

### 2. Run backend pointing at tunneled RDS

```powershell
cd backend
$env:DB_HOST="localhost"
$env:DB_PORT="5433"
$env:DB_NAME="puncher_db"
$env:DB_USER="postgres"
$env:DB_PASSWORD="<your db_password from terraform.tfvars>"
$env:PUNCHER_SEED_ENABLED="true"
.\mvnw spring-boot:run
```

**Warning:** This writes fake users and punches into your **live AWS database**. The production app will show them too. For a clean analytics-only DB, use a separate RDS instance or schema later.

Stop backend after seeding completes.

---

## Verify seeding succeeded

### Backend logs

- No line: `DataSeeder: disabled`
- Yes: `Analytics org seeded...`
- Yes: `Seeded N future punch-days` (N > 0 on first run)

### SQL (local or RDS via tunnel)

```powershell
# Local
docker exec -it puncher-01-postgres-1 psql -U postgres -d puncher_db

# AWS (tunnel on 5433)
psql "postgresql://postgres:YOUR_PASSWORD@localhost:5433/puncher_db"
```

```sql
SELECT COUNT(*) FROM departments WHERE name IN ('Human Resources', 'Operations', 'Sales & Marketing');
SELECT COUNT(*) FROM users WHERE employee_id LIKE 'ANALYTICS-%';
SELECT COUNT(*) FROM punches p JOIN users u ON u.id = p.user_id WHERE u.employee_id LIKE 'ANALYTICS-%';
SELECT COUNT(*) FROM attendance_records ar JOIN users u ON u.id = ar.user_id WHERE u.employee_id LIKE 'ANALYTICS-%';

SELECT d.name AS department, t.name AS team, COUNT(u.id) AS employees
FROM users u
JOIN teams t ON t.id = u.team_id
JOIN departments d ON d.id = u.department_id
WHERE u.employee_id LIKE 'ANALYTICS-%' AND u.role = 'EMPLOYEE'
GROUP BY d.name, t.name
ORDER BY d.name, t.name;
```

Expect: **3** departments, **~33** analytics users (managers + leaders + 24 employees), **thousands** of punches, **hundreds+** attendance rows.

### Power BI

Refresh ODBC dataset. Filter `users[employee_id]` starts with `ANALYTICS-` or slice by the three department names.

---

## Re-run / add more punch days

Seeding is idempotent:

- Existing org (`ANALYTICS-DM-HR`) is skipped
- Days that already have `WORK_START` punches are skipped
- New analytics employees get full history on first run

To re-seed org from scratch (destructive):

```sql
-- Careful: removes analytics demo data only (adjust if you added real users with ANALYTICS- prefix)
DELETE FROM attendance_records WHERE user_id IN (SELECT id FROM users WHERE employee_id LIKE 'ANALYTICS-%');
DELETE FROM punches WHERE user_id IN (SELECT id FROM users WHERE employee_id LIKE 'ANALYTICS-%');
-- ... then users, teams, departments in FK order
```

Prefer testing on **local Postgres** first, then run once on AWS.
