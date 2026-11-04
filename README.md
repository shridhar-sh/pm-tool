# AgencyPM

React, FastAPI and MongoDB project tracker. Development continues here independently of Emergent.

## Run locally

Install Docker with Compose, then from the repository root:

```sh
docker compose up --build
```

Open http://localhost:3000. Use `pm@agency.com` / `demo123` for the existing project-manager demo account. AM, LP and team demo accounts are shown on the login screen. The database persists in the `pm-data` Docker volume; `docker compose down` preserves it. This configuration binds the app to this computer only. Docker itself was unavailable in the development environment, so the Compose setup has not yet been run there.

The existing demo login is a browser-only role selector, and the API has no authentication. Keep this setup local until server-side login and permissions are implemented. It does not import or modify an existing Emergent database.

For development without Docker:

```sh
python -m pip install -r backend/requirements-test.txt
# Start your local MongoDB separately, then:
MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=agency_pm_local python -m uvicorn backend.server:app --port 8000
```

In another terminal:

```sh
cd frontend
npm ci --legacy-peer-deps
REACT_APP_BACKEND_URL=http://localhost:8000 npm start
```

The legacy-peer-deps flag accommodates the existing React 19 / calendar dependency combination. The npm lockfile fixes the tested dependency tree. Production defaults to a same-origin `/api` endpoint, with nginx proxying requests to FastAPI.

## Connected behavior

- Project details, task lists and approval requests use persisted API records.
- Task completion and reassignment appear in project and personal views. A project rename automatically appears on its tasks without another update.
- Stage progress determines dashboard status on the server. The first unfinished stage determines the phase after work begins; all stages completed closes the project. Reopening a stage reopens the corresponding phase. Date-only edits preserve manually selected status.
- Project edits, extra-day (E) markers, working-day (W) overrides and overlaps survive reload. W means a weekend/holiday is treated as a working day.
- Open screens refresh every 30 seconds while visible and when returning to the tab. This uses polling rather than instant push updates.
- AM and LP dashboards resolve unique staff short names from the team directory. Duplicate short names are not guessed.
- Runtime HTML no longer loads Emergent scripts, branding or session recording. Runtime dependencies do not require `emergentintegrations`.

## Verification

```sh
python -m unittest backend.tests.test_project_update_contract backend.tests.test_work_items_api -q
cd frontend
npm run test:calendar
npm run build
```

API tests default to an isolated Mongo-compatible in-memory test store. To run the same tests against real MongoDB, set `PM_TEST_MONGO_URL` to a local test server. Each test creates and deletes a unique `pm_automated_test_*` database.

For the browser workflow test, build the frontend first, install Playwright Chromium, and point to a disposable local MongoDB:

```sh
cd frontend
npx playwright install chromium
MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=pm_browser_test npm run test:browser
```

This test serves the real API and built frontend together, creates test records, and checks task creation/completion, approvals, stage status, E/W markers, overlaps, tab refresh and AM/LP short-name assignment. Use a disposable test database; the script creates team-directory fixtures as well as a project.

Validated during development: production build without lint warnings; 14 backend tests against MongoDB 7.0.16; 7 calendar assertions; Chromium browser workflows with the real API/database, including reloads, with no JavaScript errors.

## Work still needed

This is a working development milestone, not a fully automated production release. Remaining work includes server-side authentication/permissions, a single authoritative scheduling engine (date calculations still run in the timeline), concurrent-edit protection, linking stage work to staff tasks, live reminders, database backup/export, and historical tracker import with owner/status reconciliation. The sheet-import endpoint is still a placeholder. Old tracker data has not been migrated into this app. No paid hosting or service was provisioned.
