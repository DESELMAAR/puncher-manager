## Seed fake analytics data (Power BI)

This project includes a Java seeder that can generate consistent demo data for **attendance analytics**:

- `users`, `teams`, `departments`
- `punches` for ~2 months (weekdays)
- **`attendance_records`** derived from punches (so Power BI has a real “status per day” table)
- weekly schedules + confirmations (so schedule checks work)

### Safety

Seeding is **disabled by default**. It runs only when you enable:

- `puncher.seed.enabled=true`

### Local (recommended)

From repo root, run backend with seeding enabled:

```powershell
# From repo root
cd backend

# Enable seeding
$env:PUNCHER_SEED_ENABLED="true"

# Optional: disable attendance_records generation (not recommended for Power BI)
# $env:PUNCHER_SEED_GENERATEATTENDANCERECORDS="false"

.\mvnw spring-boot:run
```

Environment variables map to Spring properties:

- `PUNCHER_SEED_ENABLED` → `puncher.seed.enabled`
- `PUNCHER_SEED_GENERATEATTENDANCERECORDS` → `puncher.seed.generateAttendanceRecords`

### AWS RDS (seed into your cloud database)

If you want the fake data inside **AWS RDS**:

1. Start your SSH tunnel to RDS (Power BI gateway method).
2. Point the backend DB connection to your RDS database (same host/user/password).
3. Run the backend once with `PUNCHER_SEED_ENABLED=true`.
4. Stop it (seeding happens on startup).

### What changes after this

After running seeding, Power BI can analyze:

- LATE / ON_TIME counts over time (`attendance_records`)
- minutes late (`attendance_records.minutes_late`)
- work duration from punches (WORK_START → LOGOUT)
- breakdown by team/department (join through `users`)

