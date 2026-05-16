# CI pipeline explained (GitHub Actions)

This document walks through **every part** of the continuous integration (CI) workflow for Puncher Manager.

**Workflow file:** `.github/workflows/ci.yml`  
**Platform:** [GitHub Actions](https://docs.github.com/en/actions)  
**Repository:** `https://github.com/DESELMAAR/puncher-manager`

---

## What is CI and why we use it

**Continuous Integration (CI)** means: every time code is pushed or a pull request is opened, an automated server:

1. Checks out your code on a clean machine (Ubuntu in the cloud).
2. Installs the right tools (Java, Node.js).
3. Runs the same commands you would run locally (tests, lint, build).
4. Reports **pass** or **fail** on GitHub.

That way broken code is caught **before** it is merged into `main`, without everyone having to remember to run tests manually.

---

## High-level flow

```text
Push or PR to main  ──►  GitHub starts workflow "CI"
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
      Job: Backend (Maven)          Job: Frontend (Next.js)
      (runs in parallel)            (runs in parallel)
              │                               │
              ▼                               ▼
      mvn -B test                   npm ci → lint → test → build
              │                               │
              └───────────────┬───────────────┘
                              ▼
                    Both green = tests passed
                              │
                              ▼
                    Job: Docker build & push (after both)
                    build images; push to Docker Hub on main
                              ▼
                    All green = CI passed
```

The **backend** and **frontend** test jobs do **not** depend on each other. The **Docker** job runs only after **both** succeed (`needs: [backend, frontend]`).

---

## File location and format

| Item | Value |
|------|--------|
| Path | `.github/workflows/ci.yml` |
| Format | YAML (indentation matters; 2 spaces per level) |
| Name shown in GitHub UI | `CI` (from `name: CI` at the top) |

GitHub automatically discovers any `*.yml` file under `.github/workflows/` and registers it as a workflow.

---

## Section 1: Workflow name

```yaml
name: CI
```

| Part | Meaning |
|------|---------|
| `name` | Human-readable title in the GitHub **Actions** tab. |
| `CI` | Short label; you will see "CI" on commit checks and in the workflow list. |

This does not affect behavior; it is only for display.

---

## Section 2: When the workflow runs (`on`)

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
```

### `push` + `branches: [main]`

- **Triggers when:** Someone pushes commits to the **`main`** branch.
- **Typical case:** You merge a PR or push directly to `main`.
- **Does not trigger on:** Pushes to other branches (e.g. `feature/xyz`) unless you open a PR to `main`.

### `pull_request` + `branches: [main]`

- **Triggers when:** A pull request is opened or updated, and its **target** branch is `main`.
- **Typical case:** You work on a branch, open "Merge into main" — CI runs on every new commit you push to that PR.
- **Why both push and PR:** PRs get checked before merge; `push` to `main` checks again after merge.

### `workflow_dispatch`

- **Triggers when:** You start the workflow manually from the GitHub UI.
- **How:** Repository → **Actions** → **CI** → **Run workflow**.
- **Useful for:** Re-running CI without a new commit, or testing the pipeline after changing the YAML file.

---

## Section 3: Concurrency

```yaml
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### What problem this solves

If you push 3 commits quickly, GitHub could start **3 full CI runs** at once. That wastes minutes and queue time.

### `group`

- Builds a **concurrency group** name from:
  - `github.workflow` — workflow file name (here: `CI`).
  - `github.ref` — git ref, e.g. `refs/heads/main` or `refs/pull/42/merge`.
- **Effect:** All runs for the **same workflow + same branch/PR** share one group.

### `cancel-in-progress: true`

- When a **new** run starts in the same group, GitHub **cancels** older runs that are still running.
- **Effect:** Only the **latest** commit’s CI matters for that branch/PR.

**Example:** You push commit A (CI starts), then commit B 2 minutes later — CI for A is cancelled; only B is fully validated.

---

## Section 4: Jobs overview

```yaml
jobs:
  backend:
    ...
  frontend:
    ...
```

| Concept | Explanation |
|---------|-------------|
| `jobs` | Top-level map of work units. Each key (`backend`, `frontend`) is a **job id** (internal name). |
| Two jobs | Backend and frontend are **separate virtual machines**. |
| Parallel | GitHub runs both jobs at the same time by default (no `needs:` between them). |
| Success rule | The **whole workflow** succeeds only if **every** job succeeds. One failure = red X on the commit/PR. |

---

## Job A: Backend (Maven)

```yaml
  backend:
    name: Backend (Maven)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
```

### `backend`

- Internal job identifier. Used if another job had `needs: backend` (we do not use that today).

### `name: Backend (Maven)`

- Label shown in the GitHub UI for this job (status checks, logs).
- Helps distinguish from the frontend job.

### `runs-on: ubuntu-latest`

- GitHub provisions a fresh **Ubuntu Linux** runner (VM) for this job only.
- `ubuntu-latest` tracks GitHub’s current default Ubuntu image (updated periodically by GitHub).
- Your code never runs on Windows/macOS in CI unless you change this.

### `defaults.run.working-directory: backend`

- Every `run:` shell command runs **inside** the `backend/` folder.
- So `mvn -B test` is equivalent to local: `cd backend && mvn -B test`.
- Avoids repeating `working-directory` on each step.

---

### Backend step 1: Checkout

```yaml
      - name: Checkout
        uses: actions/checkout@v4
```

| Part | Meaning |
|------|---------|
| `name` | Step label in the log UI. |
| `uses` | Uses a **pre-built action** from GitHub Marketplace (not a shell command). |
| `actions/checkout@v4` | Official action: clones your repository into the runner’s workspace (`$GITHUB_WORKSPACE`). |
| `@v4` | Pins major version 4 of the action (stable API). |

**Result:** The runner has the same files as your repo at the commit that triggered CI (including `backend/pom.xml`, tests, etc.).

---

### Backend step 2: Set up JDK 17

```yaml
      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"
          cache: maven
```

| Input | Meaning |
|-------|---------|
| `distribution: temurin` | **Eclipse Temurin** JDK (common, well-supported OpenJDK build). |
| `java-version: "17"` | Matches `java.version` in `backend/pom.xml`. Spring Boot 3.2 is tested on 17. |
| `cache: maven` | Caches `~/.m2/repository` between runs so dependencies download faster on the next run. |

**Result:** `java` and `mvn` are on PATH; Maven dependencies are restored from cache when possible.

---

### Backend step 3: Run tests

```yaml
      - name: Run tests
        run: mvn -B test
```

| Part | Meaning |
|------|---------|
| `run` | Shell command executed in `backend/` (because of `defaults`). |
| `mvn` | Apache Maven — builds and tests the Java project. |
| `-B` | **Batch mode** — non-interactive, cleaner logs, fails on error (good for CI). |
| `test` | Maven lifecycle phase: compile test sources, run JUnit tests (Surefire). |

**What runs locally vs CI:**

- Uses `application-test.yml` and H2 in-memory DB (no PostgreSQL required on the runner).
- Runs tests such as `PuncherManagerApplicationTests`, `AttendanceServiceAnalyticsTest`, `DepartmentServiceTest`.

**If this step fails:** The backend job fails; the workflow fails; the PR shows a red check (unless you only care about optional checks).

---

## Job B: Frontend (Next.js)

```yaml
  frontend:
    name: Frontend (Next.js)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
```

Same ideas as the backend job: separate Ubuntu VM, all commands run in `frontend/`.

---

### Frontend step 1: Checkout

```yaml
      - name: Checkout
        uses: actions/checkout@v4
```

Same as backend. **Each job gets its own checkout** — jobs do not share disks.

---

### Frontend step 2: Set up Node.js

```yaml
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
```

| Input | Meaning |
|-------|---------|
| `node-version: "20"` | Node.js 20 LTS — compatible with Next.js 14 and your dev setup. |
| `cache: npm` | Caches npm’s global cache directory to speed up `npm ci`. |
| `cache-dependency-path` | Lockfile path **from repo root** so cache key matches `frontend/package-lock.json`. |

**Result:** `node` and `npm` are available; cached packages may speed up install.

---

### Frontend step 3: Install dependencies

```yaml
      - name: Install dependencies
        run: npm ci
```

| Part | Meaning |
|------|---------|
| `npm ci` | **Clean install** from `package-lock.json` exactly. |
| vs `npm install` | `ci` deletes `node_modules` and installs pinned versions — reproducible on every machine. |

**Requirement:** `frontend/package-lock.json` must be committed. It is in your repo.

**If lockfile is out of sync with `package.json`:** This step fails. Fix locally with `npm install` and commit the updated lockfile.

---

### Frontend step 4: Lint

```yaml
      - name: Lint
        run: npm run lint
```

| Part | Meaning |
|------|---------|
| `npm run lint` | Runs `next lint` (ESLint with Next.js rules). |
| **Purpose** | Catch style issues, unused imports, common React/TS mistakes before build. |

**If this fails:** Fix ESLint errors locally (`npm run lint` in `frontend/`), commit, push again.

---

### Frontend step 5: Unit tests

```yaml
      - name: Unit tests
        run: npm test
```

| Part | Meaning |
|------|---------|
| `npm test` | Runs `vitest run` (single run, no watch). |
| **Tests** | `pagination.test.ts`, `useTablePagination.test.tsx`, `TablePagination.test.tsx` (see `testexplaned.md`). |

**If this fails:** A unit test assertion failed or tests could not run — read the log for the failing file.

---

### Frontend step 6: Production build

```yaml
      - name: Production build
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8080
```

| Part | Meaning |
|------|---------|
| `npm run build` | Runs `next build` — TypeScript check, compile, optimize for production. |
| **Purpose** | Ensures the app **actually builds** (not only tests/lint). Catches type errors and Next.js config issues. |

### Environment variable `NEXT_PUBLIC_API_URL`

```yaml
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8080
```

| Part | Meaning |
|------|---------|
| `env` | Environment variables **only for this step** (and child processes). |
| `NEXT_PUBLIC_*` | Next.js embeds these at **build time** into client bundles. |
| `http://localhost:8080` | Placeholder API base URL (same default as in `frontend/lib/api.ts`). |

**Why a placeholder:** CI does not start the Java backend. The build still needs *some* value so code referencing `process.env.NEXT_PUBLIC_API_URL` does not break. Production deploy should set the real API URL in your hosting platform (Vercel, Docker, etc.).

**If this fails:** Often TypeScript errors, missing imports, or Next.js page errors — fix locally with `npm run build` in `frontend/`.

---

## Job C: Docker build & push

```yaml
  docker:
    name: Docker build & push
    runs-on: ubuntu-latest
    needs: [backend, frontend]
```

### Purpose

Builds **`backend/Dockerfile`** and **`frontend/Dockerfile`**, then **pushes** them to [Docker Hub](https://hub.docker.com/) when the workflow is **not** a pull request (i.e. pushes to `main` and manual `workflow_dispatch`). On PRs, images are still built to validate Dockerfiles but **not** pushed.

### `needs: [backend, frontend]`

- Docker build runs **only if** Maven tests and frontend lint/test/build all passed.
- Saves time: no point building images if unit tests already failed.

### GitHub secrets (required for push)

Add these under **Settings → Secrets and variables → Actions** in your GitHub repo:

| Secret | Value |
|--------|--------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username (e.g. `deselmaar`) |
| `DOCKERHUB_TOKEN` | A [Docker Hub access token](https://hub.docker.com/settings/security) (not your account password) |

Create the token with **Read & Write** access. Without these secrets, push steps on `main` will fail at login.

### Image names and tags on Docker Hub

After a successful push to `main`, images appear as:

| Image | Example tags |
|-------|----------------|
| `<username>/puncher-manager-backend` | `latest`, short commit SHA (e.g. `a1b2c3d`) |
| `<username>/puncher-manager-frontend` | `latest`, short commit SHA |

Pull example (replace `YOUR_USER`):

```bash
docker pull YOUR_USER/puncher-manager-backend:latest
docker pull YOUR_USER/puncher-manager-frontend:latest
```

### Step: Set up Docker Buildx

```yaml
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
```

- Enables **Buildx** (modern Docker builder with better caching and multi-platform support).
- Required for `docker/build-push-action` and GitHub Actions cache (`type=gha`).

### Step: Log in to Docker Hub

```yaml
      - name: Log in to Docker Hub
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
```

- Runs only on **push to main** and **workflow_dispatch**, not on PRs.
- Authenticates so `build-push-action` can upload layers.

### Step: Docker metadata (tags)

```yaml
      - name: Docker meta (backend)
        id: meta-backend
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.DOCKERHUB_USERNAME }}/puncher-manager-backend
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,prefix=,format=short
```

- **`latest`** — only on the default branch (`main`).
- **Short SHA** — every push (e.g. `a1b2c3d`) for pinning a specific commit.
- Same pattern for `puncher-manager-frontend`.

### Step: Build and push backend image

```yaml
      - name: Build and push backend image
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          file: ./backend/Dockerfile
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta-backend.outputs.tags }}
          labels: ${{ steps.meta-backend.outputs.labels }}
          cache-from: type=gha,scope=backend
          cache-to: type=gha,mode=max,scope=backend
```

| Input | Meaning |
|-------|---------|
| `context: ./backend` | Build context = `backend/` folder (matches `docker-compose.yml`). |
| `file` | Path to Dockerfile. |
| `push` | `true` on `main` / manual runs; `false` on PRs (build-only). |
| `tags` / `labels` | From `docker/metadata-action` (Docker Hub tags). |
| `cache-from` / `cache-to` | Reuse Docker layer cache between CI runs (faster rebuilds). |

**What the Dockerfile does:** Maven builds the JAR inside Docker (`mvn package -DskipTests`), then copies it into a small JRE image. Tests already ran in the `backend` job; Docker build skips tests intentionally for speed.

### Step: Build and push frontend image

```yaml
      - name: Build and push frontend image
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta-frontend.outputs.tags }}
          labels: ${{ steps.meta-frontend.outputs.labels }}
          build-args: |
            NEXT_PUBLIC_API_URL=http://localhost:8080
          cache-from: type=gha,scope=frontend
          cache-to: type=gha,mode=max,scope=frontend
```

| Input | Meaning |
|-------|---------|
| `build-args` | Same as `docker-compose` / local build — bakes API URL into the Next.js client bundle. |
| `scope=frontend` | Separate cache from backend so layers do not mix. |

**What the Dockerfile does:** `npm ci` → `npm run build` → production `node:20-alpine` runner with `.next` and `npm start`.

### Local equivalent

From project root:

```bash
docker compose build
# or
docker build -t puncher-manager-backend:local ./backend
docker build -t puncher-manager-frontend:local --build-arg NEXT_PUBLIC_API_URL=http://localhost:8081 ./frontend
```

---

## What CI does *not* do (today)

| Not included | Why |
|--------------|-----|
| Start PostgreSQL | Backend tests use H2 in the `test` profile. |
| Push on pull requests | PRs build only; push runs on `main` / manual dispatch. |
| Deploy to production | CI only validates; deploy is a separate step (CD). |
| Run on `develop` or other branches | Only `main` + PRs targeting `main` (unless you extend `on:`). |
| E2E / browser tests | Not set up yet. |
| Code coverage upload | Can be added later (Codecov, etc.). |

---

## How to read results on GitHub

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Click a workflow run (e.g. for your commit message).
4. You see three jobs: **Backend (Maven)**, **Frontend (Next.js)**, and **Docker build & push** (after the first two pass).
5. Click a job → expand each **step** to see logs.

On a **pull request**, checks also appear at the bottom of the PR conversation.

| Icon | Meaning |
|------|---------|
| Green check | Job passed. |
| Red X | Job failed — open logs for the failing step. |
| Yellow dot | In progress or cancelled. |

---

## Mapping: CI steps ↔ local commands

| CI step | Run locally |
|---------|-------------|
| Backend: Run tests | `cd backend && mvn test` |
| Frontend: Install | `cd frontend && npm ci` |
| Frontend: Lint | `cd frontend && npm run lint` |
| Frontend: Unit tests | `cd frontend && npm test` |
| Frontend: Production build | `cd frontend && npm run build` |

If CI fails, reproduce the failing step locally first.

---

## Optional: protect `main` with required checks

To **block merge** when CI fails:

1. GitHub → **Settings** → **Branches**.
2. Add or edit rule for **`main`**.
3. Enable **Require status checks before merging**.
4. Select:
   - `Backend (Maven)`
   - `Frontend (Next.js)`
   - `Docker build & push`
5. Save.

Then merges are only allowed when both jobs are green.

---

## Changing the pipeline later

| Goal | What to edit |
|------|----------------|
| Run on all branches | Change `on.push.branches` or remove branch filter. |
| Use Java 21 | `java-version: "21"` and `pom.xml` `java.version`. |
| Skip frontend on backend-only PRs | Add `paths` filters under each job (GitHub path filters). |
| Change registry or image names | Edit `docker/metadata-action` `images:` and login step in `ci.yml`. |
| Add deploy job | New job with `needs: [docker]` and deploy action. |
| Run only tests, skip build | Remove the "Production build" step (faster, less safety). |

---

## Quick reference: full workflow file

The live source of truth is always:

**`.github/workflows/ci.yml`**

This document describes that file as of the time it was written. If you change the YAML, update this file or re-read the workflow on GitHub.
