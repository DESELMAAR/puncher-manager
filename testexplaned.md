# Test explanation (Puncher Manager)

This document describes the automated tests in the project: what they cover, how they run, and what each test checks.

---

## How to run tests

| Layer    | Command              | Location   |
|----------|----------------------|------------|
| Backend  | `mvn test`           | `backend/` |
| Frontend | `npm test`           | `frontend/` |
| Frontend (watch) | `npm run test:watch` | `frontend/` |

## CI pipeline (GitHub Actions)

Workflow file: **`.github/workflows/ci.yml`**

Runs on every **push** and **pull request** to `main`, and can be started manually (**Actions → CI → Run workflow**).

| Job | Steps |
|-----|--------|
| **Backend (Maven)** | JDK 17 → `mvn -B test` in `backend/` |
| **Frontend (Next.js)** | Node 20 → `npm ci` → `npm run lint` → `npm test` → `npm run build` in `frontend/` |
| **Docker build & push** | After both pass → build images; push to Docker Hub on `main` (PRs build only) |

Backend and frontend test jobs run **in parallel**; Docker runs **after** both succeed.

After pushing the workflow to GitHub, open **https://github.com/DESELMAAR/puncher-manager/actions** to see runs.

**Backend:** uses the `test` Spring profile (`application-test.yml`), an in-memory **H2** database, and does **not** run the demo data seeder (`DataSeeder` is disabled with `@Profile("!test")`).

**Frontend:** uses **Vitest** with **jsdom** and **React Testing Library**.

---

## Backend tests (Java / Spring Boot)

### Configuration

| File | Role |
|------|------|
| `backend/src/test/resources/application-test.yml` | H2 in-memory DB, test JWT secret, mail stub |
| `backend/pom.xml` | `spring-boot-starter-test`, `spring-security-test`, H2; Surefire flag for newer JDKs |

### `PuncherManagerApplicationTests`

**File:** `backend/src/test/java/com/punchermanager/PuncherManagerApplicationTests.java`

| Test | What it checks |
|------|----------------|
| `contextLoads` | The Spring application context starts successfully with the `test` profile (beans, JPA, security chain). |

This is a smoke test: if configuration or wiring is broken, the test fails before any feature test runs.

---

### `AttendanceServiceAnalyticsTest`

**File:** `backend/src/test/java/com/punchermanager/service/AttendanceServiceAnalyticsTest.java`

**Type:** Unit test with **Mockito** (repositories and `PlanningService` are mocked; real `AttendanceService` logic runs).

| Test | What it checks |
|------|----------------|
| `analytics_rejectsRangeOver62Days` | Calling `analytics()` with a range longer than **62 days** throws `ApiException` with HTTP **400** and message containing `"Range too large"`. Protects the API from expensive queries. |
| `analytics_rejectsNullDates` | Missing `from` date throws **400** with `"from and to are required"`. |
| `analytics_returnsEmptyTotalsWhenNoEmployees` | When there are no employees in the org (`userRepository.findAll()` returns empty), analytics for a 7-day range returns **zero** totals and **7 daily** buckets (one per calendar day in range). |

**Why it matters:** Analytics is used on the dashboard; these rules must stay stable for UI date pickers and KPI cards.

---

### `DepartmentServiceTest`

**File:** `backend/src/test/java/com/punchermanager/service/DepartmentServiceTest.java`

**Type:** Unit test with Mockito.

| Test | What it checks |
|------|----------------|
| `create_rejectsAdminWhoIsNotDeptManager` | Creating a department with `adminId` pointing to a user with role **EMPLOYEE** (not `DEPT_MANAGER`) throws **400** and message mentions `DEPT_MANAGER`. The department is **never saved** (`departmentRepository.save` is not called). |

**Why it matters:** Only department managers should be assigned as department admins in org settings.

---

## Frontend tests (TypeScript / Vitest)

### Shared pagination logic

Admin tables (**Staff & roles**, **Employees**, **Teams**, **Departments**) show **15 rows per page** with centered **Previous / Next** controls. Logic lives in:

| File | Role |
|------|------|
| `frontend/lib/pagination.ts` | Pure functions (easy to test without React) |
| `frontend/lib/useTablePagination.ts` | React hook: page state, slice list, reset on filter change |
| `frontend/components/TablePagination.tsx` | UI: range text + centered buttons |

---

### `pagination.test.ts`

**File:** `frontend/lib/pagination.test.ts`

Tests **`TABLE_PAGE_SIZE`**, `slicePage`, `getTotalPages`, and `getPageRange` with a list of **40** items.

| Test | What it checks |
|------|----------------|
| `uses 15 rows per page by default` | Page size is **15**; page 1 returns items 1–15. |
| `slices second page correctly` | Page 2 returns items **16–30**. |
| `slices last partial page` | Page 3 returns items **31–40** (only 10 items). |
| `computes total pages` | 0 items → 1 page (minimum); 15 → 1; 16 → 2; 40 → 3. |
| `computes display range` | Footer text: e.g. page 1 of 40 → `1–15`; page 3 → `31–40`; empty list → `0–0`. |

---

### `useTablePagination.test.tsx`

**File:** `frontend/lib/useTablePagination.test.tsx`

Tests the **`useTablePagination`** hook with `@testing-library/react` `renderHook`.

| Test | What it checks |
|------|----------------|
| `starts on page 1 with first page slice` | Initial page is **1**, first **15** rows, **3** total pages for 32 items. |
| `navigates to next page` | After `setPage(2)`, first row is `row-16`. |
| `resets to page 1 when reset deps change` | Changing a filter dependency (simulated) resets page from 2 back to **1**. |

**Why it matters:** Changing department/team/search on admin pages must not leave the user on an empty page.

---

### `TablePagination.test.tsx`

**File:** `frontend/components/TablePagination.test.tsx`

Tests the **pagination bar component** (rendering and clicks).

| Test | What it checks |
|------|----------------|
| `renders nothing when totalItems is 0` | No footer when the table is empty. |
| `shows centered range and page controls` | Displays `16–30 of 40`, `Page 2 / 3`, enabled Previous/Next on middle page. |
| `disables Previous on first page` | Previous disabled, Next enabled on page 1. |
| `calls onPageChange when Next is clicked` | Clicking **Next** calls the callback with page **2**. |

Each test runs `cleanup()` after itself so multiple renders do not pollute the DOM.

---

## Test summary

| Suite | Tests | Focus |
|-------|-------|--------|
| Backend – context | 1 | App starts |
| Backend – attendance analytics | 3 | Date rules + empty analytics |
| Backend – departments | 1 | Admin role validation |
| Frontend – pagination math | 5 | 15 rows/page, slices, ranges |
| Frontend – pagination hook | 3 | Page state + filter reset |
| Frontend – pagination UI | 4 | Component behavior |
| **Total** | **17** | |

---

## What is not covered yet

These tests do **not** currently include:

- HTTP/API tests (`MockMvc` / `@WebMvcTest`) for controllers
- End-to-end browser tests (Playwright, Cypress)
- Full integration tests against PostgreSQL
- Authentication / JWT flows
- Punch, schedule, or notification modules

Those can be added later using the same patterns (unit tests for services, API tests for endpoints).

---

## Troubleshooting

**Backend – Mockito / Java 25:** If mocks fail with Byte Buddy errors, the project sets `-Dnet.bytebuddy.experimental=true` in the Maven Surefire plugin. Use a supported JDK (17–21 recommended for production) if issues persist.

**Frontend – duplicate buttons in tests:** Component tests call `cleanup()` after each case so previous renders do not remain in the document.
